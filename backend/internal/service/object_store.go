package service

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/aliyun/alibabacloud-oss-go-sdk-v2/oss"
	"github.com/aliyun/alibabacloud-oss-go-sdk-v2/oss/credentials"
	"github.com/google/uuid"
	"github.com/wanye/ideaevo/internal/config"
)

var allowedContentTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"video/mp4":  ".mp4",
}

const (
	MaxImageBytes int64 = 5 * 1024 * 1024  // 图片上限 5MB
	MaxVideoBytes int64 = 50 * 1024 * 1024 // 视频上限 50MB
)

// MaxAssetBytes 是旧符号的别名,保持向后兼容(= 图片上限)。
const MaxAssetBytes int64 = MaxImageBytes

// isVideoContentType 判断 content type 是否为视频。
func isVideoContentType(ct string) bool {
	return strings.HasPrefix(ct, "video/")
}

// maxBytesFor 按内容类型返回大小上限(图片 5MB / 视频 50MB)。
func maxBytesFor(contentType string) int64 {
	if isVideoContentType(contentType) {
		return MaxVideoBytes
	}
	return MaxImageBytes
}

type ObjectStore struct {
	client    *oss.Client
	bucket    string
	region    string
	cdnDomain string
	enabled   bool
}

func NewObjectStore(cfg *config.Config) (*ObjectStore, error) {
	if cfg.AliyunAccessKeyID == "" || cfg.AliyunAssetsBucket == "" {
		return &ObjectStore{enabled: false}, nil
	}

	ossCfg := oss.LoadDefaultConfig().
		WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			cfg.AliyunAccessKeyID,
			cfg.AliyunAccessKeySecret,
		)).
		WithRegion(cfg.AliyunAssetsRegion)

	client := oss.NewClient(ossCfg)
	return &ObjectStore{
		client:    client,
		bucket:    cfg.AliyunAssetsBucket,
		region:    cfg.AliyunAssetsRegion,
		cdnDomain: strings.TrimSuffix(cfg.AliyunAssetsCDNDomain, "/"),
		enabled:   true,
	}, nil
}

type PresignResult struct {
	UploadURL  string `json:"upload_url"`
	PublicURL  string `json:"public_url"`
	Key        string `json:"key"`
	ExpiresIn  int    `json:"expires_in"`
}

func (s *ObjectStore) Enabled() bool {
	return s != nil && s.enabled
}

// PresignPut 为指定主体预签名一个上传 URL。
// scope 为 "users"、"agents" 或 "ideas"；id 为对应的 user_id / agent_id / idea_id。
func (s *ObjectStore) PresignPut(scope, id, kind, contentType string) (*PresignResult, error) {
	if !s.Enabled() {
		return nil, errors.New("对象存储未配置")
	}
	if scope != "users" && scope != "agents" && scope != "ideas" {
		return nil, errors.New("上传范围无效")
	}
	if kind != "avatar" && kind != "background" && kind != "icon" && kind != "content" && kind != "cover" && kind != "video" {
		return nil, errors.New("上传类型无效")
	}
	if scope == "ideas" && kind != "icon" && kind != "content" && kind != "cover" && kind != "video" {
		return nil, errors.New("想法仅支持 icon / content / cover / video 上传")
	}
	if (scope == "users" || scope == "agents") && (kind == "icon" || kind == "content") {
		return nil, errors.New("上传类型无效")
	}
	ext, ok := allowedContentTypes[contentType]
	if !ok {
		return nil, errors.New("不支持的文件类型")
	}

	key := fmt.Sprintf("%s/%s/%s/%s%s", scope, id, kind, uuid.New().String(), ext)
	req := &oss.PutObjectRequest{
		Bucket:      oss.Ptr(s.bucket),
		Key:         oss.Ptr(key),
		ContentType: oss.Ptr(contentType),
	}

	result, err := s.client.Presign(context.Background(), req, oss.PresignExpires(15*time.Minute))
	if err != nil {
		return nil, err
	}

	publicURL := s.publicURL(key)
	return &PresignResult{
		UploadURL: result.URL,
		PublicURL: publicURL,
		Key:       key,
		ExpiresIn: 900,
	}, nil
}

func (s *ObjectStore) publicURL(key string) string {
	if s.cdnDomain != "" {
		return s.cdnDomain + "/" + key
	}
	return fmt.Sprintf("https://%s.%s.aliyuncs.com/%s", s.bucket, s.region, key)
}

func (s *ObjectStore) IsAllowedURL(raw string) bool {
	if !s.Enabled() {
		return false
	}
	u, err := url.Parse(raw)
	if err != nil {
		return false
	}
	// 允许 users/、agents/ 与 ideas/ 三种前缀。
	pathOK := strings.HasPrefix(u.Path, "/users/") ||
		strings.HasPrefix(u.Path, "/agents/") ||
		strings.HasPrefix(u.Path, "/ideas/")
	if s.cdnDomain != "" {
		cdn, _ := url.Parse(s.cdnDomain)
		if cdn != nil && strings.EqualFold(u.Host, cdn.Host) {
			return pathOK
		}
	}
	expectedHost := fmt.Sprintf("%s.%s.aliyuncs.com", s.bucket, s.region)
	return strings.EqualFold(u.Host, expectedHost) && pathOK
}

func (s *ObjectStore) KeyFromURL(raw string) (string, error) {
	if !s.IsAllowedURL(raw) {
		return "", errors.New("文件地址不允许")
	}
	u, err := url.Parse(raw)
	if err != nil {
		return "", err
	}
	key := strings.TrimPrefix(u.Path, "/")
	if key == "" {
		return "", errors.New("文件标识无效")
	}
	return key, nil
}

// ValidateUploadedObject 校验上传对象归属（前缀须为 {scope}/{id}/）并检查存在性/大小/类型。
func (s *ObjectStore) ValidateUploadedObject(key, scope, id string) error {
	if !s.Enabled() {
		return errors.New("对象存储未配置")
	}
	if !strings.HasPrefix(key, fmt.Sprintf("%s/%s/", scope, id)) {
		return errors.New("无权访问该文件")
	}

	result, err := s.client.HeadObject(context.Background(), &oss.HeadObjectRequest{
		Bucket: oss.Ptr(s.bucket),
		Key:    oss.Ptr(key),
	})
	if err != nil {
		return fmt.Errorf("上传的文件不存在，请重新上传")
	}
	ct := ""
	if result.ContentType != nil {
		ct = *result.ContentType
	}
	maxBytes := maxBytesFor(ct)
	if result.ContentLength > maxBytes {
		_, _ = s.client.DeleteObject(context.Background(), &oss.DeleteObjectRequest{
			Bucket: oss.Ptr(s.bucket),
			Key:    oss.Ptr(key),
		})
		if isVideoContentType(ct) {
			return errors.New("视频不能超过 50MB")
		}
		return errors.New("图片不能超过 5MB")
	}
	if ct != "" {
		if _, ok := allowedContentTypes[ct]; !ok {
			return errors.New("文件类型无效")
		}
	}
	return nil
}

func (s *ObjectStore) DeleteUserPrefix(userID string) error {
	if !s.Enabled() {
		return nil
	}
	prefix := fmt.Sprintf("users/%s/", userID)
	paginator := s.client.NewListObjectsV2Paginator(&oss.ListObjectsV2Request{
		Bucket: oss.Ptr(s.bucket),
		Prefix: oss.Ptr(prefix),
	})
	for paginator.HasNext() {
		page, err := paginator.NextPage(context.Background())
		if err != nil {
			return err
		}
		if len(page.Contents) == 0 {
			continue
		}
		keys := make([]string, 0, len(page.Contents))
		for _, obj := range page.Contents {
			if obj.Key != nil {
				keys = append(keys, *obj.Key)
			}
		}
		_, err = s.client.DeleteMultipleObjects(context.Background(), &oss.DeleteMultipleObjectsRequest{
			Bucket: oss.Ptr(s.bucket),
			Objects: func() []oss.DeleteObject {
				out := make([]oss.DeleteObject, len(keys))
				for i, k := range keys {
					out[i] = oss.DeleteObject{Key: oss.Ptr(k)}
				}
				return out
			}(),
		})
		if err != nil {
			return err
		}
	}
	return nil
}
