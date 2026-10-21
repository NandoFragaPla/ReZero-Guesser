import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CharacterData } from "../javascript/character_data.js";
import { setLang } from "../javascript/i18n.js";

const echidna = `|Affiliation          =
|Previous Affiliation = [[Witch#Witches of Sin|Witches of Sin]]<br>[[Witch Era Party]]<br>[[Sanctuary]]<br>Kugelschreiber Castle
|Status               = Deceased (original body)<br>Alive (as [[Omega]])
|Relatives            = [[Pandora]] (mother)`;

describe("formatação da wiki", () => {
  const cd = new CharacterData();

  it("não corta a afiliação no | de um link e tira o colchete do status", () => {
    assert.equal(cd.readTemplateField(echidna, "Affiliation"), "N/A");
    const affiliation = cd.readTemplateField(echidna, "Previous Affiliation");
    assert.match(affiliation, /Witches of Sin/);
    assert.match(affiliation, /Sanctuary/);
    assert.doesNotMatch(affiliation, /Witchwitches/);
    assert.doesNotMatch(affiliation, /Previous Affiliation/);
    assert.deepEqual(cd.parseAffiliationList(affiliation), [
      "Witches of Sin",
      "Witch Era Party",
      "Sanctuary",
      "Kugelschreiber Castle",
    ]);

    setLang("en");
    assert.equal(
      cd.translateStatus("Deceased (original body)<br>Alive (as [[Omega]])"),
      "Deceased (original body)<br>Alive (as Omega)",
    );

    setLang("pt");
    assert.equal(
      cd.translateStatus("Deceased (original body)<br>Alive (as [[Omega]])"),
      "Morto (Corpo original)<br>Vivo (Como Omega)",
    );
  });
});
