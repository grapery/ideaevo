package handler

import (
	"errors"
	"strings"

	"github.com/go-playground/validator/v10"
)

var fieldLabels = map[string]string{
	"Email":       "邮箱",
	"Password":    "密码",
	"OldPassword": "当前密码",
	"NewPassword": "新密码",
	"Name":        "昵称",
	"Phone":       "手机号",
	"Code":        "验证码",
	"Token":       "令牌",
	"Title":       "标题",
	"Content":     "内容",
	"AgentID":     "Agent ID",
	"Kind":        "上传类型",
	"ContentType": "文件类型",
}

func FriendlyBindError(err error) string {
	var verrs validator.ValidationErrors
	if errors.As(err, &verrs) {
		for _, fe := range verrs {
			label := fieldLabels[fe.Field()]
			if label == "" {
				label = fe.Field()
			}
			switch fe.Tag() {
			case "required":
				return "请填写" + label
			case "email":
				return label + "格式不正确"
			case "min":
				return label + "长度不足"
			case "max":
				return label + "过长"
			case "oneof":
				return label + "取值无效"
			default:
				return label + "无效"
			}
		}
	}

	msg := err.Error()
	if strings.Contains(msg, "EOF") || strings.Contains(msg, "invalid character") || strings.Contains(msg, "cannot unmarshal") {
		return "请求格式无效"
	}
	return "请求参数无效"
}

func FriendlyMessage(msg string) string {
	switch msg {
	case "password must be 6-128 chars":
		return "密码长度需为 6-128 个字符"
	case "upload not configured":
		return "图片上传服务未配置"
	case "sms not configured":
		return "短信服务未配置"
	case "failed to generate token":
		return "登录令牌生成失败"
	case "failed to issue session":
		return "登录会话生成失败"
	case "missing token":
		return "缺少验证令牌"
	case "missing authorization":
		return "缺少授权信息"
	case "login required":
		return "请先登录"
	case "invalid session":
		return "登录已失效，请重新登录"
	case "content is required":
		return "请输入消息内容"
	case "user not found":
		return "用户不存在"
	case "google oauth not configured":
		return "Google 登录未配置"
	case "invalid api key":
		return "API Key 无效"
	case "missing or invalid authorization":
		return "缺少或无效的授权信息"
	case "not authenticated":
		return "未认证，请先输入 API Key"
	case "agent not found":
		return "Agent 不存在"
	case "idea not found":
		return "想法不存在"
	case "admin access required":
		return "需要管理员权限"
	default:
		return msg
	}
}

func ServiceError(err error) string {
	if err == nil {
		return ""
	}
	return FriendlyMessage(err.Error())
}
