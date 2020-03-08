var Sequelize = require('sequelize');
var express = require('express');
var router = express.Router();
var TaskType = require('../model/task/task_type');
var Task = require('../model/task/task');
var Team = require('../model/team/team');
var Reference = require('../model/reference');
var User = require('../model/user');
var TaskGroup = require('../model/task/task_group');
var Worklog = require('../model/worklog');

const Op = Sequelize.Op;

router.get('/', function(req, res, next) {
    return res.json({message: 'Response tasks resource'});
});

//Task
// 1. Search task function
router.get('/searchTaskByKeywordAndLevel', function(req, res, next) {
  var reqTaskKeyWord = req.query.reqTaskKeyword.trim();
  var reqTaskLevel = Number(req.query.reqTaskLevel);
  Task.findAll({
    include: [{
      model: TaskType, 
      attributes: ['Name']
    }],
    where: {
      [Op.or]: [
        {TaskName: {[Op.like]:'%' + reqTaskKeyWord + '%'}},
        {Description: {[Op.like]:'%' + reqTaskKeyWord + '%'}},
        {TopOppName: {[Op.like]:'%' + reqTaskKeyWord + '%'}}
      ],
      TaskName: {[Op.notLike]: 'Dummy - %'},
      TaskLevel: reqTaskLevel
    },
    order: [
      ['createdAt', 'DESC']
    ]
  }).then(async function(tasks) {
      if(tasks != null && tasks.length > 0) {
        var response = await generateTaskList(tasks);
        return res.json(responseMessage(0, response, ''));
      } else {
        return res.json(responseMessage(1, null, 'No task exist'));
      }
  })
});

//1. Get Task list for web PMT
router.get('/getTaskList', function(req, res, next) {
  var reqPage = Number(req.query.reqPage);
  var reqSize = Number(req.query.reqSize);
  var taskCriteria = generateTaskCriteria(req);
  var taskTypeCriteria = generateTaskTypeCriteria(req);
  Task.findAll({
    include: [{
      model: TaskType, 
      attributes: ['Name'],
      where: taskTypeCriteria
    }],
    where: taskCriteria,
    order: [
      ['createdAt', 'DESC']
    ],
    limit: reqSize,
    offset: reqSize * (reqPage - 1),
  }).then(async function(tasks) {
    if(tasks != null && tasks.length > 0) {
      var response = await generateTaskList(tasks);
      return res.json(responseMessage(0, response, ''));
    } else {
      return res.json(responseMessage(1, null, 'No task exist'));
    } 
  })
});

router.get('/getTaskListTotalSize', function(req, res, next) {
  var taskCriteria = generateTaskCriteria(req);
  var taskTypeCriteria = generateTaskTypeCriteria(req);
  Task.findAll({
    include: [{
      model: TaskType, 
      attributes: ['Name'],
      where: taskTypeCriteria
    }],
    where: taskCriteria
  }).then(async function(tasks) {
    if(tasks != null && tasks.length > 0) {
      var resJson = {};
      resJson.task_list_total_size = tasks.length;
      return res.json(responseMessage(0, resJson, ''));
    } else {
      return res.json(responseMessage(1, null, 'No task exist'));
    } 
  })
});

function generateTaskCriteria(iReq) {
  var reqTaskLevel = Number(iReq.query.reqTaskLevel);
  var criteria = {
    TaskName: {[Op.notLike]: 'Dummy - %'},
    TaskLevel: reqTaskLevel,
    Id: { [Op.ne]: null }
  }
  if (iReq.query.reqTaskKeyword != null && iReq.query.reqTaskKeyword != '') {
    var reqTaskKeyWord = iReq.query.reqTaskKeyword.trim();
    var searchKeywordCriteria = {
      [Op.or]: [
        {TaskName: {[Op.like]:'%' + reqTaskKeyWord + '%'}},
        {Description: {[Op.like]:'%' + reqTaskKeyWord + '%'}},
        {TopOppName: {[Op.like]:'%' + reqTaskKeyWord + '%'}}
      ]
    }
    var c1 = Object.assign(criteria, searchKeywordCriteria);
  } 
  if (iReq.query.reqFilterAssignee != null && iReq.query.reqFilterAssignee != '') {
    criteria.AssigneeId = Number(iReq.query.reqFilterAssignee)
  }
  if (iReq.query.reqFilterStatus != null && iReq.query.reqFilterStatus != '') {
    criteria.Status = iReq.query.reqFilterStatus
  }
  var reqFilterIssueDateStart = null;
  var reqFilterIssueDateEnd = null;
  if (iReq.query.reqFilterIssueDateStart != null && iReq.query.reqFilterIssueDateStart != '') {
    reqFilterIssueDateStart = iReq.query.reqFilterIssueDateStart + ' 00:00:00'
  }
  if (iReq.query.reqFilterIssueDateEnd != null && iReq.query.reqFilterIssueDateEnd != '') {
    reqFilterIssueDateEnd = iReq.query.reqFilterIssueDateEnd + ' 23:59:59'
  }
  if (reqFilterIssueDateStart != null && reqFilterIssueDateEnd != null) {
    var issueDateCriteria = {
      [Op.and]: [
        { IssueDate: { [Op.gte]:  reqFilterIssueDateStart }},
        { IssueDate: { [Op.lte]:  reqFilterIssueDateEnd }}
      ]
    }
    var c2 = Object.assign(criteria, issueDateCriteria);
  }
  return criteria;
}

function generateTaskTypeCriteria(iReq) {
  var taskTypeCriteria = {}
  if (iReq.query.reqFilterShowRefPool != null && iReq.query.reqFilterShowRefPool != '') {
    if (iReq.query.reqFilterShowRefPool == 'true') {
      taskTypeCriteria = {
        Name: 'Pool'
      }
    } else {
      taskTypeCriteria = {
        Name: { [Op.ne]: 'Pool' }
      }
    }
  } else {
    taskTypeCriteria = {
      Name: { [Op.ne]: 'Pool' }
    }
  }
  return taskTypeCriteria;
}

function generateTaskList(iTaskObjArray) {
  return new Promise(async (resolve, reject) => {
    var rtnResult = [];
    for (var i=0; i<iTaskObjArray.length; i++) {
      var resJson = {}
      resJson.task_id = iTaskObjArray[i].Id;
      resJson.task_name = iTaskObjArray[i].TaskName;
      // Level 2 ~ 4
      resJson.task_parent_name = iTaskObjArray[i].ParentTaskName;
      resJson.task_level = iTaskObjArray[i].TaskLevel;
      resJson.task_desc = iTaskObjArray[i].Description;
      resJson.task_status = iTaskObjArray[i].Status;
      resJson.task_effort = iTaskObjArray[i].Effort;
      resJson.task_estimation = iTaskObjArray[i].Estimation;
      resJson.task_scope = iTaskObjArray[i].Scope;
      resJson.task_reference = iTaskObjArray[i].Reference;
      var assigneeId = iTaskObjArray[i].AssigneeId;
      if (assigneeId != null && assigneeId != '') {
        var assigneeName = await getUserById(assigneeId);
        resJson.task_assignee = assigneeName;
      } else {
        resJson.task_assignee = null;
      }
      resJson.task_issue_date = iTaskObjArray[i].IssueDate;
      resJson.task_target_complete = iTaskObjArray[i].TargetCompleteDate;
      //Level 1
      resJson.task_top_opp_name = iTaskObjArray[i].TopOppName;
      resJson.task_top_customer = iTaskObjArray[i].TopCustomer;
      resJson.task_top_type_of_work = iTaskObjArray[i].TopTypeOfWork;
      resJson.task_top_team_sizing = iTaskObjArray[i].TopTeamSizing;
      var respLeaderId = iTaskObjArray[i].RespLeaderId;
      if (respLeaderId != null && respLeaderId != '') {
        var respLeaderName = await getUserById(respLeaderId);
        resJson.task_top_resp_leader = respLeaderName;
      } else {
        resJson.task_top_resp_leader = null;
      }
      var trgtStartTime = iTaskObjArray[i].TopTargetStart;
      if( trgtStartTime != null && trgtStartTime != ''){
        var startTime = new Date(trgtStartTime);
        resJson.task_top_target_start = startTime.getFullYear() + '-' + ((startTime.getMonth() + 1) < 10 ? '0' + (startTime.getMonth() + 1) : (startTime.getMonth() + 1));
      } else {
        resJson.task_top_target_start = null
      }
      rtnResult.push(resJson);  
    } 
    resolve(rtnResult);
  });
}

function getUserById(iUserId) {
  return new Promise((resolve, reject) => {
    User.findOne({
      where: {
        Id: iUserId
      }
    }).then(function(user) {
      if(user != null) {
        resolve(user.Name)
      } else {
        resolve(null);
      }
    });
  });
}

//2. Get Task by Id
router.post('/getTaskById', function(req, res, next) {
  console.log('Start to get task by id: ' + req.body.reqTaskId)
  Task.findOne({
    include: [{
      model: TaskType, 
      attributes: ['Name']
    }],
    where: {
      Id: req.body.reqTaskId 
    }
  }).then(async function(task) {
    if(task != null) {
      var response = await generateTaskInfo(task);
      return res.json(responseMessage(0, response, ''));  
    } else {
      return res.json(responseMessage(1, null, 'No task exist'));
    }
  })
});

router.post('/getTaskByName', function(req, res, next) {
  console.log('Start to get task by name: ' + req.body.reqTaskName)
  Task.findOne({
    include: [{
      model: TaskType, 
      attributes: ['Name']
    }],
    where: {
      TaskName: req.body.reqTaskName 
    }
  }).then(async function(task) {
    if(task != null) {
      var response = await generateTaskInfo(task);
      return res.json(responseMessage(0, response, ''));  
    } else {
      return res.json(responseMessage(1, null, 'No task exist'));
    }
  })
});

function generateTaskInfo (iTask) {
  return new Promise(async (resolve, reject) => {
    var resJson = {};
    resJson.task_id = iTask.Id;
    resJson.task_parent_name = iTask.ParentTaskName;
    if(iTask.ParentTaskName != 'N/A') {
      resJson.task_parent_desc = await getTaskDescription(iTask.ParentTaskName);
      resJson.task_parent_type = await getTaskType(iTask.ParentTaskName)
    } else {
      resJson.task_parent_desc = null;
      resJson.task_parent_type = null;
    }
    resJson.task_name = iTask.TaskName;
    resJson.task_level = iTask.TaskLevel;
    resJson.task_desc = iTask.Description;
    resJson.task_type_id = iTask.TaskTypeId;
    resJson.task_type = iTask.task_type.Name;
    resJson.task_creator = iTask.Creator;
    resJson.task_status = iTask.Status;
    resJson.task_effort = iTask.Effort;
    if(iTask.Estimation != null && iTask.Estimation >0){
      resJson.task_estimation =  iTask.Estimation;
      resJson.task_progress = toPercent(iTask.Effort, iTask.Estimation);
      var percentage =  "" + toPercent(iTask.Effort, iTask.Estimation);
      resJson.task_progress_nosymbol = percentage.replace("%","");
    } else {
      resJson.task_estimation = "0"
      resJson.task_progress = "0";
      resJson.task_progress_nosymbol = "0";
    }
    if(Number(iTask.TaskLevel) === 1) {
      resJson.task_subtasks_estimation = 0;
    } else {
      resJson.task_subtasks_estimation = await getSubTaskTotalEstimation(iTask.TaskName);
    }
    if(resJson.task_subtasks_estimation > 0) {
      resJson.task_progress = toPercent(iTask.Effort, resJson.task_subtasks_estimation);
      resJson.task_progress_nosymbol = resJson.task_progress.replace("%","");
    }
    resJson.task_issue_date = iTask.IssueDate;
    resJson.task_target_complete = iTask.TargetCompleteDate;
    resJson.task_actual_complete = iTask.ActualCompleteDate;
    resJson.task_responsible_leader = iTask.RespLeaderId;
    resJson.task_assignee = iTask.AssigneeId;
    resJson.task_reference = iTask.Reference;
    if(iTask.Reference != null && iTask.Reference != '') {
      resJson.task_reference_desc = await getTaskDescription(iTask.Reference);
    } else {
      resJson.task_reference_desc = null;
    }
    resJson.task_scope = iTask.Scope;
    resJson.task_group_id = iTask.TaskGroupId;
    resJson.task_top_constraint = iTask.TopConstraint;
    resJson.task_top_opp_name = iTask.TopOppName;
    resJson.task_top_customer = iTask.TopCustomer;
    resJson.task_top_facing_client = iTask.TopFacingClient;
    resJson.task_top_type_of_work = iTask.TopTypeOfWork;
    resJson.task_top_chance_winning = iTask.TopChanceWinning;
    resJson.task_top_sow_confirmation = iTask.TopSowConfirmation;
    resJson.task_top_business_value = iTask.TopBusinessValue;
    resJson.task_top_target_start = iTask.TopTargetStart;
    resJson.task_top_target_end = iTask.TopTargetEnd;
    resJson.task_top_paint_points = iTask.TopPaintPoints;
    resJson.task_top_team_sizing = iTask.TopTeamSizing;
    resJson.task_top_skill = iTask.TopSkill;
    resJson.task_top_opps_project = iTask.TopOppsProject;
    resolve(resJson);
  });
}

function getSubTaskTotalEstimation(iTaskName) {
  return new Promise((resolve, reject) => {
    console.log(iTaskName)
    Task.findAll({
      include: [{
        model: TaskType, 
        attributes: ['Name'],
        where: {
          Name: { [Op.ne]: 'Pool' }
          }
      }],
      where: {
        ParentTaskName: iTaskName
      }
    }).then(async function(task) {
      if(task != null && task.length > 0) {
        var rtnTotalEstimation = 0
        for(var i=0; i< task.length; i++){
          var subTaskCount = await getSubTaskCount(task[i].TaskName);
          var subTaskEstimation = 0;
          if(subTaskCount != null && subTaskCount > 0){
            subTaskEstimation = await getSubTaskTotalEstimation(task[i].TaskName);
            rtnTotalEstimation = rtnTotalEstimation + Number(subTaskEstimation);
          } else {
            if(task[i].Estimation != null && task[i].Estimation != ''){
              rtnTotalEstimation = rtnTotalEstimation + Number(task[i].Estimation);
            }
          }
        }
        resolve(rtnTotalEstimation);
      } else {
        resolve(0);
      }
    });
  })
}

function getTaskDescription(iTaskname) {
  return new Promise((resolve, reject) => {
    Task.findOne({
      where: {
        TaskName: iTaskname 
      }
    }).then(function(task) {
      if (task != null) {
        if(task.TaskLevel == 1) {
          resolve(task.TopOppName);
        } else {
          resolve(task.Description);
        }
      } else {
        resolve(null);
      }
    });
  });
}

function getTaskType(iTaskname) {
  return new Promise((resolve, reject) => {
    Task.findOne({
      include: [{
        model: TaskType, 
        attributes: ['Name']
      }],
      where: {
        TaskName: iTaskname 
      }
    }).then(function(task) {
      if (task != null) {
        resolve(task.task_type.Name)
      } else {
        resolve(null);
      }
    });
  });
}

router.post('/getSubTaskByTaskName', function(req, res, next) {
  var rtnResult = [];
  Task.findAll({
    attributes: ['Id', 'TaskName', 'Description'],
    where: {
      ParentTaskName: req.body.reqTaskName
    },
    order: [
      ['Id', 'ASC']
    ]
  }).then(function(task) {
      if(task.length > 0) {
        for(var i=0;i<task.length;i++){
          var resJson = {};
          resJson.task_id = task[i].Id;
          resJson.task_name = task[i].TaskName;
          resJson.task_desc = task[i].Description;
          rtnResult.push(resJson);
        }
        return res.json(responseMessage(0, rtnResult, ''));
      } else {
        return res.json(responseMessage(1, null, 'No sub task exist'));
      }
  })
});

//3. Save task
router.post('/saveTask', function(req, res, next) {
  saveTask(req, res);
});

async function saveTask(req, res) {
  var reqTask = JSON.parse(req.body.reqTask);
  var reqTaskName = reqTask.task_name;
  var reqTaskParent = reqTask.task_parent_name;
  if((reqTaskName == null || reqTaskName == '') && reqTaskParent != 'N/A'){
    reqTaskName = await getSubTaskName(reqTaskParent);
  }
  var taskObj = {
    ParentTaskName: reqTaskParent,
    TaskName: reqTaskName,
    Description: reqTask.task_desc != ''? reqTask.task_desc: null,
    Priority: null,
    Status: reqTask.task_status != ''? reqTask.task_status: null,
    Creator: reqTask.task_creator != ''? reqTask.task_creator: null,
    TaskTypeId: reqTask.task_type_id != ''? Number(reqTask.task_type_id): null,
    Effort: reqTask.task_effort != ''? Number(reqTask.task_effort): 0,
    Estimation: reqTask.task_estimation != ''? Number(reqTask.task_estimation): 0,
    IssueDate: reqTask.task_issue_date != ''? reqTask.task_issue_date: null,
    TargetCompleteDate: reqTask.task_target_complete != ''? reqTask.task_target_complete: null,
    ActualCompleteDate: reqTask.task_actual_complete != ''? reqTask.task_actual_complete: null,
    BusinessArea: null,
    BizProject: null,
    TaskLevel: reqTask.task_level != ''? reqTask.task_level: 0,
    RespLeaderId: reqTask.task_responsible_leader != ''? reqTask.task_responsible_leader: null,
    AssigneeId: reqTask.task_assignee != ''? reqTask.task_assignee: null,
    Reference: reqTask.task_reference != ''? reqTask.task_reference: null,
    Scope: reqTask.task_scope != ''? reqTask.task_scope: null,
    TopConstraint: reqTask.task_top_constraint != ''? reqTask.task_top_constraint: null,
    TopOppName: reqTask.task_top_opp_name != ''? reqTask.task_top_opp_name: null,
    TopCustomer: reqTask.task_top_customer != ''? reqTask.task_top_customer: null,
    TopFacingClient: reqTask.task_top_facing_client != ''? reqTask.task_top_facing_client: null,
    TopTypeOfWork: reqTask.task_top_type_of_work != ''? reqTask.task_top_type_of_work: null,
    TopChanceWinning: reqTask.task_top_chance_winning != ''? reqTask.task_top_chance_winning: null, 
    TopSowConfirmation: reqTask.task_top_sow_confirmation != ''? reqTask.task_top_sow_confirmation: null,
    TopBusinessValue: reqTask.task_top_business_value != ''? reqTask.task_top_business_value: null,
    TopTargetStart: reqTask.task_top_target_start != ''? reqTask.task_top_target_start: null,
    TopTargetEnd: reqTask.task_top_target_end != ''? reqTask.task_top_target_end: null,
    TopPaintPoints: reqTask.task_top_paint_points != ''? reqTask.task_top_paint_points: null,
    TopTeamSizing: reqTask.task_top_team_sizing != ''? reqTask.task_top_team_sizing: null,
    TopSkill: reqTask.task_top_skill != ''? reqTask.task_top_skill: null,
    TopOppsProject: reqTask.task_top_opps_project != ''? reqTask.task_top_opps_project: null,
    TaskGroupId: reqTask.task_group_id != ''? reqTask.task_group_id: null
  }
  Task.findOrCreate({
      where: { TaskName: reqTaskName }, 
      defaults: taskObj
    })
    .spread(async function(task, created) {
      if(created) {
        console.log("Task created"); 
        return res.json(responseMessage(0, task, 'Task Created'));
      } else {
        console.log("Task existed");
        await Task.update(taskObj, {where: { TaskName: reqTaskName }});
        //Update sub-tasks responsilbe leader
        if (Number(reqTask.task_level) == 2) {
          var updateResult1 = await updateSubTasksRespLeader(reqTask.task_name, reqTask.task_responsible_leader);
        }
        return res.json(responseMessage(1, task, 'Task existed'));
      }
  });
}

async function getSubTaskName(iParentTask) {
  console.log('Start to get Sub task Name!!')
  var subTasks = await getSubTasks(iParentTask);
  var subTaskCount = 0;
  if(subTasks != null && subTasks.length > 0) {
    var lastSubTaskName = subTasks[subTasks.length-1].TaskName;
    var nameArr = lastSubTaskName.split('-');
    var lastNameNum = Number(nameArr[nameArr.length-1]);
    var subTasksLength = subTasks.length;
    console.log('Sub Task Last Number: ' + lastNameNum);
    console.log('Sub Task Length: ' + subTasksLength);
    if(lastNameNum == subTasksLength) {
      subTaskCount = subTasksLength;
    }
    if(lastNameNum < subTasksLength) {
      subTaskCount = subTasksLength;
    }
    if(lastNameNum > subTasksLength) {
      subTaskCount = lastNameNum;
    }
  }
  subTaskCount = Number(subTaskCount) + 1;
  var taskName = iParentTask + '-' + subTaskCount;
  console.log('Sub Task Name: ' + taskName);
  return taskName;
}

function getSubTaskCount(iParentTask) {
  return new Promise((resolve, reject) => {
    Task.findAll({
      where: {
        ParentTaskName: iParentTask
      }
    }).then(function(task) {
      if(task != null) {
        console.log('Task length: ' + task.length);
        resolve(task.length);
      } else {
        resolve(0);
      }
    });
  });
}

function updateSubTasksGroup (iTaskName, iGroupId) {
  return new Promise((resolve, reject) => {
    Task.update({
        TaskGroupId: iGroupId != '' ? iGroupId : null
      },
      {where: {ParentTaskName: iTaskName}
    });
    resolve(0);
  });
}

function updateSubTasksRespLeader (iTaskName, iRespLeaderId) {
  return new Promise((resolve, reject) => {
    Task.findAll({
      where: {
        ParentTaskName: iTaskName
      }
    }).then(async function(tasks) {
      if (tasks != null && tasks.length > 0) {
        await Task.update({RespLeaderId: iRespLeaderId != '' ? iRespLeaderId : null}, {where: {ParentTaskName: iTaskName}});
        for(var i=0; i<tasks.length; i++) {
          await updateSubTasksRespLeader(tasks[i].TaskName, iRespLeaderId)
        }
        resolve(0);
      } else {
        resolve(1);
      }
    });
  });
}

function getSubTasks (iTaskName) {
  return new Promise((resolve, reject) => {
    Task.findAll({
      where: {
        ParentTaskName: iTaskName
      },
      order: [
        ['createdAt', 'DESC']
      ]
    }).then(function(task) {
      if(task != null && task.length > 0){
        resolve(task);
      } else {
        resolve(null)
      }
    })
  });
}

router.post('/getTaskByNameForParentTask', function(req, res, next) {
  var rtnResult = [];
  var reqTaskKeyWord = req.body.reqTaskKeyword.trim();
  var reqTaskLevel = req.body.reqTaskLevel;
  Task.findAll({
    include: [{
      model: TaskType, 
      attributes: ['Name'],
      where: {
        Name: { [Op.ne]: 'Pool' }
      }
    }],
    where: {
      [Op.or]: [
        {TaskName: {[Op.like]:'%' + reqTaskKeyWord + '%'}},
        {Description: {[Op.like]:'%' + reqTaskKeyWord + '%'}},
        {TopOppName: {[Op.like]:'%' + reqTaskKeyWord + '%'}}
      ],
      TaskName: {[Op.notLike]: 'Dummy - %'},
      TaskLevel: reqTaskLevel,
      Id: { [Op.ne]: null }
    },
    limit: 30,
    order: [
      ['createdAt', 'DESC']
    ]
  }).then(async function(task) {
    if(task.length > 0) {
      for(var i=0;i<task.length;i++){
        var resJson = {};
        resJson.task_id = task[i].Id;
        resJson.task_name = task[i].TaskName;
        resJson.task_desc = task[i].Description;
        if(resJson.task_desc == null || resJson.task_desc == '') {
          resJson.task_desc = task[i].TopOppName;
        }
        resJson.task_type = task[i].task_type.Name;
        resJson.task_type_id = task[i].TaskTypeId;
        resJson.task_responsible_leader = task[i].RespLeaderId;
        rtnResult.push(resJson);
      }
      return res.json(responseMessage(0, rtnResult, ''));
    } else {
      return res.json(responseMessage(1, null, 'No task exist'));
    }
  })
});

router.post('/getTaskByNameForRefPool', function(req, res, next) {
  var rtnResult = [];
  var reqTaskKeyWord = req.body.reqTaskKeyword.trim();
  Task.findAll({
    include: [{
      model: TaskType, 
      attributes: ['Name'],
      where: {
        Name: 'Pool'
      }
    }],
    where: {
      [Op.or]: [
        {TaskName: {[Op.like]:'%' + reqTaskKeyWord + '%'}},
        {Description: {[Op.like]:'%' + reqTaskKeyWord + '%'}},
        {TopOppName: {[Op.like]:'%' + reqTaskKeyWord + '%'}}
      ],
      TaskName: {[Op.notLike]: 'Dummy - %'},
      TaskLevel: 3,
      Id: { [Op.ne]: null }
    },
    limit: 30,
    order: [
      ['createdAt', 'DESC']
    ]
  }).then(async function(task) {
    if(task.length > 0) {
      for(var i=0;i<task.length;i++){
        var resJson = {};
        resJson.task_id = task[i].Id;
        resJson.task_name = task[i].TaskName;
        resJson.task_desc = task[i].Description;
        rtnResult.push(resJson);
      }
      return res.json(responseMessage(0, rtnResult, ''));
    } else {
      return res.json(responseMessage(1, null, 'No task exist'));
    }
  })
});

router.post('/removeTaskIfNoSubTaskAndWorklog', async function(req, res, next) {
  console.log(JSON.stringify(req.body))
  var reqTaskId = req.body.tTaskId;
  var reqTaskName = req.body.tTaskName;
  var reqUpdateDate = req.body.tUpdateDate;
  var subTaskCount = await getSubTaskCount(reqTaskName);
  if(subTaskCount == 0) {
    var worklogExist = await checkWorklogExist(reqTaskId, reqUpdateDate);
    if(!worklogExist) {
      console.log('No worklog exist, can remove outdate worklog and task safely!');
      //Remove worklog of this task
      var result1 = false; 
      var result2 = false;
      result1 = await removeWorklogBefore3Days(reqTaskId, reqUpdateDate);
      if(result1) {
        console.log('Remove worklog done');
      }
      result2 = await removeTask(reqTaskId);
      if(result2){
        console.log('Remove task done');
      }
      return res.json(responseMessage(0, null, 'Task removed successfully!'));
    } else {
      return res.json(responseMessage(1, null, 'Task existed worklog updated records within 3 days, could not be removed!'));
    } 
  } else {
    return res.json(responseMessage(1, null, 'Task existed sub tasks, could not be removed!'));
  }
});

function checkWorklogExist (iTaskId, iUpdateDate) {
  return new Promise(async (resolve, reject) => {
    Worklog.findAll({
      where: {
        [Op.or]: [
          {
            TaskId: iTaskId,
            Effort: { [Op.ne]: 0}
          },
          {
            TaskId: iTaskId,
            Effort: 0,
            updatedAt: { [Op.gt]: iUpdateDate}
          }
        ]
      }
    }).then(function(worklog) {
      if(worklog != null && worklog.length > 0) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

function removeWorklogBefore3Days(iTaskId, iUpdateDate) {
  return new Promise((resolve, reject) => {
    Worklog.findAll({
      where: {
        TaskId: iTaskId,
        Effort: 0,
        updatedAt: { [Op.lt]: iUpdateDate}
      }
    }).then(function(worklog) {
      if(worklog != null) {
        Worklog.destroy({
          where: {
            TaskId: iTaskId,
            Effort: 0,
            updatedAt: { [Op.lt]: iUpdateDate}
          }
        }).then(function(){
          resolve(true)
        });
      } else {
        resolve(false)
      }
    });
  });
}

function removeTask(iTaskId) {
  return new Promise((resolve, reject) => {
    Task.findOne({
      where: {
        Id: iTaskId
      }
    }).then(function(task) {
      if(task != null) {
        task.destroy().then(function(){
          resolve(true);
        });
      } else {
        resolve(false);
      }
    });
  });
}

router.post('/getTaskByNameForWorklogTask', function(req, res, next) {
  var rtnResult = [];
  var taskKeyWord = req.body.tTaskName.trim();
  Task.findAll({
    include: [{
      model: TaskType, 
      attributes: ['Name'],
      where: {
        Name: { [Op.ne]: 'Pool' }
      }
    }],
    where: {
      [Op.or]: [
        {TaskName: {[Op.like]:'%' + taskKeyWord + '%'}},
        {Description: {[Op.like]:'%' + taskKeyWord + '%'}}
      ],
      TaskName: {[Op.notLike]: 'Dummy - %'},
      [Op.and]: [
        { TaskLevel: {[Op.ne]: 1}},
        { TaskLevel: {[Op.ne]: 2}}
      ],
      [Op.and]: [
        { Status: {[Op.ne]: 'Drafting'}},
        { Status: {[Op.ne]: 'Planning'}}
      ],
      Id: { [Op.ne]: null }
    },
    limit:100,
    order: [
      ['updatedAt', 'DESC']
    ]
  }).then(async function(task) {
    if(task.length > 0) {
      for(var i=0;i<task.length;i++){
        var existSubTask = await getSubTaskExist(task[i].TaskName);
        if(existSubTask){
          continue;
        }
        var resJson = {};
        resJson.task_id = task[i].Id;
        resJson.task_name = task[i].TaskName;
        resJson.task_desc = task[i].Description;
        rtnResult.push(resJson);
      }
      return res.json(responseMessage(0, rtnResult, ''));
    } else {
      return res.json(responseMessage(1, null, 'No task exist'));
    }
  })
});

function getSubTaskExist (iParentTaskName) {
  return new Promise((resolve, reject) => {
    Task.findAll({
      where: {
        ParentTaskName: iParentTaskName 
      }
    }).then(function(task) {
      if(task != null && task.length > 0) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

//Task Type
router.get('/getAllTaskType', function(req, res, next) {
  var rtnResult = [];
  TaskType.findAll().then(function(taskType) {
    if(taskType.length > 0) {
      for(var i=0;i<taskType.length;i++){
        var resJson = {};
        resJson.type_id = taskType[i].Id;
        resJson.type_name = taskType[i].Name;
        resJson.type_prefix = taskType[i].Prefix;
        resJson.type_category = taskType[i].Category;
        resJson.type_value = taskType[i].Value;
        resJson.type_parent = taskType[i].ParentType;
        rtnResult.push(resJson);
      }
      return res.json(responseMessage(0, rtnResult, ''));
    } else {
      return res.json(responseMessage(1, null, 'No task type existed'));
    }
  })
});

router.post('/addTaskType', function(req, res, next) {
  var reqData = {}
  if( req.body.taskTypeId != "0"){
    reqData = { Id: req.body.taskTypeId };
  } else {
    reqData = { Name: req.body.taskTypeName };
  }
  TaskType.findOrCreate({
    where: reqData, 
    defaults: {
      ParentType: req.body.taskTypeParent,
      Name: req.body.taskTypeName,
      Prefix: req.body.taskTypePrefix,
      Category: req.body.taskTypeCategory,
      Value: req.body.taskTypeValue
    }})
  .spread(function(taskType, created) {
    if(created) {
      return res.json(responseMessage(0, taskType, 'Created task type successfully!'));
    } 
    else if(taskType != null && !created) {
      var oldPrefix = taskType.Prefix;
      var newPrefix = req.body.taskTypePrefix
      if(oldPrefix !== newPrefix) {
        console.log('Old Prefix['+oldPrefix+'] New Prefix['+newPrefix+']');
      }
      taskType.update({
        ParentType: req.body.taskTypeParent,
        Name: req.body.taskTypeName,
        Prefix: req.body.taskTypePrefix,
        Category: req.body.taskTypeCategory,
        Value: req.body.taskTypeValue
      });
      return res.json(responseMessage(0, taskType, 'Updated task type successfully!'));
    }
    else {
      return res.json(responseMessage(1, null, 'Created task type failed'));
    }
  });
});

router.post('/getNewTaskNumberByType', function(req, res, next) {
  var reqTaskTypeId = req.body.tTaskTypeId;
  TaskType.findOne({
    where: {Id: reqTaskTypeId}
  }).then(function(taskType) {
    if(taskType != null && taskType.Prefix != '') {
      Reference.findOne({where: {Name: 'TaskSeq'}}).then(function(reference) {
        if (reference != null) {
          var newTaskNumber = Number(reference.Value) + 1;
          var newTask = '' + taskType.Prefix + prefixZero(newTaskNumber, 6);
          return res.json(responseMessage(0, {task_name: newTask}, 'Get new task number successfully!'));
        } else {
          return res.json(responseMessage(1, null, 'Get new task number failed'));
        }
      });
    } else {
      return res.json(responseMessage(1, null, 'Get new task number failed'));
    }
  })
});

//Task Group
router.get('/getTaskGroup', function(req, res, next) {
  var rtnResult = [];
  var groupCriteria = {}
  if( req.query.tGroupId != "0"){
    groupCriteria = { 
      Id: req.query.tGroupId,
      RelatedTaskName: req.query.tGroupRelatedTask
    };
  } else {
    groupCriteria = { 
      Id: { [Op.ne]: null },
      RelatedTaskName: req.query.tGroupRelatedTask
    };
  }
  TaskGroup.findAll({
    where: groupCriteria,
    order: [
      ['createdAt', 'DESC']
    ]
  }).then(async function(taskGroup) {
    if(taskGroup.length > 0) {
      for(var i=0;i<taskGroup.length;i++){
        var resJson = {};
        resJson.group_id = taskGroup[i].Id;
        resJson.group_name = taskGroup[i].Name;
        resJson.group_start_time = taskGroup[i].StartTime;
        resJson.group_end_time = taskGroup[i].EndTime;
        var taskGroupTasks = await getTaskGroupTask(taskGroup[i].Id);
        var level2TaskCount = 0;
        var level3TaskCount = 0;
        var level4TaskCount = 0;
        if(taskGroupTasks != null && taskGroupTasks.length > 0) {
          for(var a=0; a<taskGroupTasks.length; a++){
            if(taskGroupTasks[a].TaskLevel == 2){
              level2TaskCount = level2TaskCount + 1;
            }
            if(taskGroupTasks[a].TaskLevel == 3){
              level3TaskCount = level3TaskCount + 1;
            }
            if(taskGroupTasks[a].TaskLevel == 4){
              level4TaskCount = level4TaskCount + 1;
            }
          }
        }
        resJson.group_lv2_task_count = level2TaskCount;
        resJson.group_lv3_task_count = level3TaskCount;
        resJson.group_lv4_task_count = level4TaskCount;
        rtnResult.push(resJson);
      }
      return res.json(responseMessage(0, rtnResult, ''));
    } else {
      return res.json(responseMessage(1, null, 'No task group existed'));
    }
  })
});

function getTaskGroupTask (iGroupId) {
  return new Promise((resolve, reject) => {
    Task.findAll({
      where: {
        TaskGroupId: iGroupId,
        Status:  { [Op.ne]: 'Drafting' }
      }
    }).then(function(task) {
      if(task != null && task.length > 0) {
        resolve(task);
      } else {
        resolve(null);
      }
    });
  });
}

router.get('/getTaskGroupAll', function(req, res, next) {
  var rtnResult = [];
  TaskGroup.findAll({
    order: [
      ['createdAt', 'DESC']
    ]
  }).then(async function(taskGroup) {
    if(taskGroup.length > 0) {
      for(var i=0;i<taskGroup.length;i++){
        var resJson = {};
        resJson.group_id = taskGroup[i].Id;
        resJson.group_name = taskGroup[i].Name;
        resJson.group_start_time = taskGroup[i].StartTime;
        resJson.group_end_time = taskGroup[i].EndTime;
        rtnResult.push(resJson);
      }
      return res.json(responseMessage(0, rtnResult, ''));
    } else {
      return res.json(responseMessage(1, null, 'No task group existed'));
    }
  })
});

router.post('/addOrUpdateTaskGroup', function(req, res, next) {
  TaskGroup.findOrCreate({
    where: { 
      Id: req.body.tGroupId 
    }, 
    defaults: {
      Name: req.body.tGroupName,
      StartTime: req.body.tGroupStartTime,
      EndTime: req.body.tGroupEndTime,
      RelatedTaskName: req.body.tGroupRelatedTask
    }})
  .spread(function(taskGroup, created) {
    if(created) {
      return res.json(responseMessage(0, taskGroup, 'Created task group successfully!'));
    } 
    else if(taskGroup != null && !created) {
      taskGroup.update({
        Name: req.body.tGroupName,
      StartTime: req.body.tGroupStartTime,
      EndTime: req.body.tGroupEndTime,
      RelatedTaskName: req.body.tGroupRelatedTask
      });
      return res.json(responseMessage(0, taskGroup, 'Updated task group successfully!'));
    }
    else {
      return res.json(responseMessage(1, null, 'Created/Update task group failed'));
    }
  });
});

function responseMessage(iStatusCode, iDataArray, iErrorMessage) {
  var resJson = {}; 
  resJson = {status: iStatusCode, data: iDataArray, message: iErrorMessage};
  return resJson;
}

function toPercent(numerator, denominator){
  var point = Number(numerator) / Number(denominator);
  if (point > 1) {
    point = 1;
  }
  var str=Number(point*100).toFixed(0);
  str+="%";
  return str;
}

function prefixZero(num, n) {
  return (Array(n).join(0) + num).slice(-n);
}

/*function dateToString(date) {  
  var y = date.getFullYear();  
  var m = date.getMonth() + 1;  
  m = m < 10 ? ('0' + m) : m;  
  var d = date.getDate();  
  d = d < 10 ? ('0' + d) : d;  
  var h = date.getHours();  
  var minute = date.getMinutes();  
  minute = minute < 10 ? ('0' + minute) : minute; 
  var second= date.getSeconds();  
  second = minute < 10 ? ('0' + second) : second;  
  return y + '-' + m + '-' + d+' '+h+':'+minute+':'+ second;  
};*/


module.exports = router;
