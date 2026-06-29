package service

import (
	"fmt"
	"strings"
)

// VectorFilterFromOptions 把检索选项转为向量库 metadata 过滤条件。
func VectorFilterFromOptions(opts SearchOptions) map[string]any {
	f := make(map[string]any)
	if opts.Status != "" {
		f["status"] = opts.Status
	}
	if opts.OwnerUserID != "" {
		f["owner_user_id"] = opts.OwnerUserID
	}
	return f
}

// DashVectorFilterExpr 将 filter map 转为 DashVector filter 表达式。
// 例：status = 'active' and owner_user_id = 'uuid'
func DashVectorFilterExpr(f map[string]any) string {
	if len(f) == 0 {
		return ""
	}
	parts := make([]string, 0, len(f))
	for k, v := range f {
		switch val := v.(type) {
		case string:
			if val == "" {
				continue
			}
			parts = append(parts, fmt.Sprintf("%s = '%s'", k, escapeDashVectorString(val)))
		default:
			parts = append(parts, fmt.Sprintf("%s = '%v'", k, val))
		}
	}
	return strings.Join(parts, " and ")
}

func escapeDashVectorString(s string) string {
	return strings.ReplaceAll(s, "'", "\\'")
}
