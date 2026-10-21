import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CharacterData } from "../javascript/character_data.js";
import { getMode, setMode } from "../javascript/i18n.js";

describe("modo anime", () => {
  const cd = new CharacterData();

  it("conta aparição real e ignora quem só foi mencionado", () => {
    assert.equal(cd.appearedInAnime("[[Episode 5]]"), true);
    assert.equal(cd.appearedInAnime("Episode 27 (mentioned)<br>Episode 28 (actual)"), true);
    assert.equal(cd.appearedInAnime("Episode 43 (flashback)"), true);
    assert.equal(cd.appearedInAnime("Episode 80 (mentioned)"), false);
    assert.equal(cd.appearedInAnime("N/A"), false);
    assert.equal(cd.appearedInAnime(""), false);
  });

  it("o modo completo usa a lista inteira e o anime só o conjunto marcado", async () => {
    setMode("complete");
    cd.loadCharacters = async () => ["Subaru", "Hector", "Novel Only"];
    cd.animeSet = new Set(["Subaru", "Hector"]);
    assert.deepEqual(await cd.getPlayableCharacters(), ["Subaru", "Hector", "Novel Only"]);

    setMode("anime");
    assert.deepEqual(await cd.getPlayableCharacters(), ["Subaru", "Hector"]);
    assert.equal(getMode(), "anime");

    setMode("complete");
  });
});
