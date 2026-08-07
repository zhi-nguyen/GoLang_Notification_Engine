package logger

import (
	"testing"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
)

func TestInitLogger(t *testing.T) {
	l := Init("debug")
	assert.Equal(t, zerolog.DebugLevel, zerolog.GlobalLevel())
	assert.NotNil(t, l)

	lInfo := Init("info")
	assert.Equal(t, zerolog.InfoLevel, zerolog.GlobalLevel())
	assert.NotNil(t, lInfo)
}
