import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CharacterData } from "../javascript/character_data.js";
import { format, getLang, setLang, t } from "../javascript/i18n.js";

describe("idioma", () => {
  it("traduz a interface e os dados do palpite", () => {
    const cd = new CharacterData();
    setLang("pt");
    assert.equal(getLang(), "pt");
    assert.equal(t("colGender"), "Gênero");
    assert.equal(format("count", { n: 3 }), "Quantidade de personagens carregados: 3");
    assert.equal(cd.translateHint("Brown", "hair"), "Castanho");
    assert.equal(cd.translateHint("Episode 5", "debut"), "Episódio 5");
    assert.equal(cd.translateAffiliation("Witch Cult"), "Culto da Bruxa");

    setLang("en");
    assert.equal(t("colGender"), "Gender");
    assert.equal(format("count", { n: 3 }), "Characters loaded: 3");
    assert.equal(cd.translateHint("Brown", "hair"), "Brown");
    assert.equal(cd.translateHint("Episode 5", "debut"), "Episode 5");
    assert.equal(cd.translateAffiliation("Witch Cult"), "Witch Cult");
    assert.equal(t("unknown"), "Unknown");

    setLang("pt");
  });
});
