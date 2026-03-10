package app

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/someblackmagic/web-application-firewall-go/internal/jail"
	"github.com/someblackmagic/web-application-firewall-go/internal/observability/logging"
	"github.com/someblackmagic/web-application-firewall-go/internal/observability/sentry"
	"github.com/someblackmagic/web-application-firewall-go/internal/underattack"
)

func WaitForShutdown(
	server *http.Server,
	jailManager *jail.Manager,
	sentryClient *sentry.Client,
	underAttackMw *underattack.Middleware,
	logger *logging.Logger,
) {
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM, syscall.SIGQUIT)
	sig := <-quit

	logger.Info("Received shutdown signal", "signal", sig.String())

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	jailManager.Stop()
	underAttackMw.Stop()

	if err := server.Shutdown(ctx); err != nil {
		logger.Error("Server forced to shutdown", "error", err)
	}

	sentryClient.Flush(5 * time.Second)
	logger.Sync()
}
