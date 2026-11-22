package media

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"nijghor/server/internal/config"
	"nijghor/server/internal/middleware"
)

const maxBlobSize = 50 * 1024 * 1024 // 50 MB max encrypted blob

type Handler struct {
	cfg        *config.Config
	storageDir string
}

func NewHandler(cfg *config.Config) *Handler {
	storageDir := filepath.Join(os.TempDir(), "nijghor_media_blobs")
	_ = os.MkdirAll(storageDir, 0700)

	return &Handler{
		cfg:        cfg,
		storageDir: storageDir,
	}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux, authMiddleware *middleware.AuthMiddleware) {
	mux.Handle("POST /api/media/upload", authMiddleware.RequireAuth(http.HandlerFunc(h.handleUpload)))
	mux.HandleFunc("GET /api/media/{blobId}", h.handleDownload)
}

func (h *Handler) handleUpload(w http.ResponseWriter, r *http.Request) {
	// Limit request body
	r.Body = http.MaxBytesReader(w, r.Body, maxBlobSize)

	// Generate random 16-byte blob ID
	idBytes := make([]byte, 16)
	if _, err := rand.Read(idBytes); err != nil {
		http.Error(w, `{"error":"internal random error"}`, http.StatusInternalServerError)
		return
	}
	blobID := hex.EncodeToString(idBytes)

	// Save encrypted bytes to storage (Server relay stores only opaque ciphertext)
	filePath := filepath.Join(h.storageDir, blobID+".enc")
	file, err := os.OpenFile(filePath, os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		log.Printf("[MEDIA] Error creating blob file: %v", err)
		http.Error(w, `{"error":"storage error"}`, http.StatusInternalServerError)
		return
	}
	defer file.Close()

	written, err := io.Copy(file, r.Body)
	if err != nil {
		log.Printf("[MEDIA] Error streaming upload: %v", err)
		_ = os.Remove(filePath)
		http.Error(w, `{"error":"upload streaming failed"}`, http.StatusBadRequest)
		return
	}

	log.Printf("[MEDIA] Encrypted blob saved: %s (%d bytes)", blobID, written)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_, _ = fmt.Fprintf(w, `{"blob_id":"%s","size":%d}`, blobID, written)
}

func (h *Handler) handleDownload(w http.ResponseWriter, r *http.Request) {
	blobID := r.PathValue("blobId")
	if blobID == "" || strings.Contains(blobID, "..") || strings.Contains(blobID, "/") {
		http.Error(w, "invalid blob id", http.StatusBadRequest)
		return
	}

	filePath := filepath.Join(h.storageDir, blobID+".enc")
	file, err := os.Open(filePath)
	if err != nil {
		http.Error(w, "blob not found or expired", http.StatusNotFound)
		return
	}
	defer file.Close()

	// Opaque binary stream with defensive cache headers
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Cache-Control", "public, max-age=86400, immutable")
	w.Header().Set("X-Content-Type-Options", "nosniff")

	_, _ = io.Copy(w, file)
}
