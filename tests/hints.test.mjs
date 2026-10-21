import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CharacterData } from "../javascript/character_data.js";
import { affiliationsMap } from "../javascript/character_afiliation_data.js";

describe("dicas em português", () => {
  const cd = new CharacterData();

  it("traduz volume, episódio e cor do exemplo", () => {
    assert.equal(cd.translateHint("Re:Zero Light Novel Volume 3", "debut"), "Volume 3");
    assert.equal(cd.translateHint("Episode 5", "debut"), "Episódio 5");
    assert.equal(cd.translateHint("Brown", "hair"), "Castanho");
  });

  it("traduz observações e mais de uma estreia", () => {
    assert.equal(
      cd.translateHint("Episode 27 (mentioned)<br>Episode 28 (actual)", "debut"),
      "Episódio 27 (mencionado)<br>Episódio 28 (aparição)",
    );
    assert.equal(
      cd.translateHint("Dark Green (most commonly seen)", "hair"),
      "Verde-escuro (aparência mais comum)",
    );
    assert.equal(
      cd.translateHint("Grey (current)<br>Chestnut Brown (past)", "hair"),
      "Cinza (atual)<br>Castanho (passado)",
    );
  });

  it("distingue light novel, Ex e Tanpenshuu", () => {
    assert.equal(cd.translateHint("Re:Zero Ex Light Novel Volume 5", "debut"), "Ex, volume 5");
    assert.equal(
      cd.translateHint("Re:Zero Tanpenshuu Volume 10", "debut"),
      "Tanpenshuu, volume 10",
    );
    assert.equal(cd.translateHint("Arc 6 (mentioned)", "debut"), "Arco 6 (mencionado)");
    assert.equal(
      cd.translateHint("Petra's Emilia Camp Struggle / Page 3 (side story)", "debut"),
      "Petra's Emilia Camp Struggle / Página 3 (história paralela)",
    );
  });

  it("mantém N/A e desconhecido", () => {
    assert.equal(cd.translateHint("N/A", "hair"), "N/A");
    assert.equal(cd.translateHint("Unknown", "hair"), "Desconhecido");
  });

  it("não trata seções da wiki como personagem", () => {
    assert.equal(cd.isSelectableCharacter("Characters"), false);
    assert.equal(cd.isSelectableCharacter("Minor Characters"), false);
    assert.equal(cd.isSelectableCharacter("Natsuki Subaru"), true);
  });

  it("traduz o Culto da Bruxa no singular", () => {
    assert.equal(affiliationsMap["Witch Cult"], "Culto da Bruxa");
    assert.equal(cd.translateAffiliation("Witch Cult"), "Culto da Bruxa");
  });
});
