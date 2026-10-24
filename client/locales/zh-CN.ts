import type { AppResource } from './en-US.js';
import systemZhCN from './system/zh-CN.js';

const zhCN: AppResource = {
  // The template's own copy; see `./en-US.ts`.
  ...systemZhCN,
  tasks: {
    assignee: '负责人',
    unassigned: '未分配',
    assigneeUnavailable: '用户不可用',
    assigneeInvalid: '该用户已不可用，请选择其他用户或设为未分配。',
    assigneeHelp: '选择一个启用的用户，也可以暂不分配。',
    assigneeCap: '本例只列出前 100 个启用的用户。',

    readPermission: '查看任务',
    updatePermission: '完成或恢复任务',
    title: '任务',
    description: '创建任务，记录完成情况。',
    new: '新建任务',
    create: '创建',
    cancel: '取消',
    taskTitle: '标题',
    status: '状态',
    actions: '操作',
    pending: '未完成',
    completed: '已完成',
    complete: '完成',
    reopen: '恢复',
    emptyTitle: '还没有任务',
    emptyDescription: '创建第一个任务，开始记录你的工作。',
    askAdmin: '请联系管理员开通创建任务的权限。',
    formDescription: '用一个简短、清晰的标题描述任务。',
    required: '请输入任务标题。',
    tooLong: '标题不能超过 120 个字符。',
    created: '已创建“{{title}}”。',
    updated: '已更新“{{title}}”。',
    loading: '加载中',
    retry: '重试',
    signIn: '重新登录',
    sessionExpired: '登录已过期，请重新登录后继续。',
    forbidden: '没有操作权限，请联系管理员。',
    notFound: '任务已不存在，列表将刷新。',
    invalidInput: '请检查任务标题后重试。',
    requestFailed: '请求失败，请重试。',
    capNotice:
      '本教程展示最近更新的 100 个任务。用于更大的列表前，请添加分页。',
  },
};

export default zhCN;
