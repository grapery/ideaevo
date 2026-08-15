package service

import (
	"context"
	"log"
	"time"
)

// asyncPutWithRetry 后台写入向量，失败时延迟重试一次。
func asyncPutWithRetry(label string, put func(ctx context.Context) error) {
	go func() {
		runWithRetry(label, put)
	}()
}

// asyncDeleteWithRetry 后台删除向量，失败时延迟重试一次。
func asyncDeleteWithRetry(label string, del func(ctx context.Context) error) {
	go func() {
		runWithRetry(label, del)
	}()
}

func runWithRetry(label string, fn func(ctx context.Context) error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := fn(ctx); err != nil {
		log.Printf("[vector] async %s failed: %v, retrying...", label, err)
		time.Sleep(2 * time.Second)
		ctx2, cancel2 := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel2()
		if err2 := fn(ctx2); err2 != nil {
			log.Printf("[vector] async %s retry failed: %v", label, err2)
		}
	}
}
