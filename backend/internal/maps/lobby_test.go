package maps

import (
	"os"
	"testing"
)

func TestCompileRealLobby(t *testing.T) {
	tmj, err := os.ReadFile("../../../assets/maps/templates/lobby.tmj")
	if err != nil {
		t.Skip("lobby.tmj não encontrado")
	}
	c, err := Compile(tmj)
	if err != nil {
		t.Fatalf("lobby inválido: %v", err)
	}
	if got := c.AreaAt(24, 14); got != "sala-reuniao" {
		t.Errorf("área em (24,14): %q", got)
	}
	if got := c.AreaAt(10, 10); got != "" {
		t.Errorf("(10,10) não deveria ter área: %q", got)
	}
	if p, ok := c.PortalAt(2, 2); !ok || p.X != 26 || p.Y != 2 {
		t.Errorf("portal (2,2): %+v %v", p, ok)
	}
	if c.Walkable(22, 13) {
		t.Error("parede da sala (22,13) deveria bloquear")
	}
	if !c.Walkable(25, 12) {
		t.Error("porta (25,12) deveria estar livre")
	}
	if !c.Walkable(24, 14) {
		t.Error("interior da sala deveria ser transitável")
	}
}
