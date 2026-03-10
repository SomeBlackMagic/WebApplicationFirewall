package logging

import (
	"github.com/someblackmagic/web-application-firewall-go/pkg/envx"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

type Logger struct {
	sugar *zap.SugaredLogger
}

func NewLogger() *Logger {
	level := zapcore.InfoLevel
	if envx.EnvBoolean("WAF_LOG_DEBUG", false) {
		level = zapcore.DebugLevel
	}

	cfg := zap.Config{
		Level:            zap.NewAtomicLevelAt(level),
		Development:      false,
		Encoding:         "json",
		EncoderConfig:    zap.NewProductionEncoderConfig(),
		OutputPaths:      []string{"stdout"},
		ErrorOutputPaths: []string{"stderr"},
	}

	logger, err := cfg.Build()
	if err != nil {
		// Fallback to nop logger
		logger = zap.NewNop()
	}

	return &Logger{sugar: logger.Sugar()}
}

func (l *Logger) WithCategory(name string) *Logger {
	return &Logger{sugar: l.sugar.Named(name)}
}

func (l *Logger) Info(msg string, args ...interface{}) {
	l.sugar.Infow(msg, args...)
}

func (l *Logger) Debug(msg string, args ...interface{}) {
	l.sugar.Debugw(msg, args...)
}

func (l *Logger) Warn(msg string, args ...interface{}) {
	l.sugar.Warnw(msg, args...)
}

func (l *Logger) Error(msg string, args ...interface{}) {
	l.sugar.Errorw(msg, args...)
}

func (l *Logger) Fatal(msg string, args ...interface{}) {
	l.sugar.Fatalw(msg, args...)
}

func (l *Logger) Sync() {
	l.sugar.Sync()
}
