package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisClient struct {
	Client *redis.Client
}

func NewRedisClient(ctx context.Context, redisURL string) (*RedisClient, error) {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("parse redis url: %w", err)
	}

	client := redis.NewClient(opt)
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("ping redis: %w", err)
	}

	return &RedisClient{Client: client}, nil
}

func (r *RedisClient) Close() error {
	if r.Client != nil {
		return r.Client.Close()
	}
	return nil
}

// ----------------- Presence Tracking -----------------

func (r *RedisClient) SetPresence(ctx context.Context, userID string, isOnline bool) error {
	key := fmt.Sprintf("presence:%s", userID)
	if isOnline {
		return r.Client.Set(ctx, key, "1", 60*time.Second).Err()
	}
	return r.Client.Del(ctx, key).Err()
}

func (r *RedisClient) GetPresence(ctx context.Context, userID string) (bool, error) {
	key := fmt.Sprintf("presence:%s", userID)
	val, err := r.Client.Get(ctx, key).Result()
	if err == redis.Nil {
		return false, nil
	} else if err != nil {
		return false, err
	}
	return val == "1", nil
}

// ----------------- Rate Limiting (Token Bucket / Sliding Window) -----------------

func (r *RedisClient) AllowRateLimit(ctx context.Context, key string, maxRequests int64, window time.Duration) (bool, error) {
	rateKey := fmt.Sprintf("ratelimit:%s", key)
	count, err := r.Client.Incr(ctx, rateKey).Result()
	if err != nil {
		return false, err
	}
	if count == 1 {
		r.Client.Expire(ctx, rateKey, window)
	}
	return count <= maxRequests, nil
}

// ----------------- Ephemeral Offline Queue (Max 30 days TTL) -----------------

func (r *RedisClient) EnqueueOfflineMessage(ctx context.Context, recipientID string, msgID string, payload []byte) error {
	queueKey := fmt.Sprintf("offline:queue:%s", recipientID)
	dataKey := fmt.Sprintf("offline:msg:%s:%s", recipientID, msgID)

	// Save message payload with 30-day TTL (auto-deleted if uncollected)
	if err := r.Client.Set(ctx, dataKey, payload, 30*24*time.Hour).Err(); err != nil {
		return err
	}

	// Append msgID to user's ordered queue
	score := float64(time.Now().UnixNano())
	if err := r.Client.ZAdd(ctx, queueKey, redis.Z{Score: score, Member: msgID}).Err(); err != nil {
		return err
	}

	// Queue key expires in 30 days as well
	r.Client.Expire(ctx, queueKey, 30*24*time.Hour)
	return nil
}

func (r *RedisClient) GetOfflineMessageIDs(ctx context.Context, recipientID string, limit int64) ([]string, error) {
	queueKey := fmt.Sprintf("offline:queue:%s", recipientID)
	return r.Client.ZRange(ctx, queueKey, 0, limit-1).Result()
}

func (r *RedisClient) GetOfflineMessagePayload(ctx context.Context, recipientID string, msgID string) ([]byte, error) {
	dataKey := fmt.Sprintf("offline:msg:%s:%s", recipientID, msgID)
	return r.Client.Get(ctx, dataKey).Bytes()
}

func (r *RedisClient) AckOfflineMessage(ctx context.Context, recipientID string, msgID string) error {
	queueKey := fmt.Sprintf("offline:queue:%s", recipientID)
	dataKey := fmt.Sprintf("offline:msg:%s:%s", recipientID, msgID)

	pipe := r.Client.Pipeline()
	pipe.ZRem(ctx, queueKey, msgID)
	pipe.Del(ctx, dataKey)
	_, err := pipe.Exec(ctx)
	return err
}
