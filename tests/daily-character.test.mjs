import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CharacterData } from "../javascript/character_data.js";

function roster(size) {
  return Array.from({ length: size }, (_, i) => `Personagem ${String(i).padStart(3, "0")}`);
}

function sortedCopy(list) {
  return list.slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function picks(cd, list, start, count) {
  return Array.from({ length: count }, (_, i) =>
    cd.pickCharacter(list, new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)),
  );
}

describe("personagem do dia", () => {
  it("escolhe o mesmo personagem para a mesma data, em qualquer instância", () => {
    const list = roster(40);
    const date = new Date(2026, 9, 21, 15, 30, 0);
    const first = new CharacterData().pickCharacter(list, date);
    const second = new CharacterData().pickCharacter(list, date);
    assert.equal(first, second);
    assert.ok(list.includes(first));
  });

  it("ignora a hora e a ordem em que a wiki devolve os nomes", () => {
    const list = roster(40);
    const cd = new CharacterData();
    const morning = new Date(2026, 9, 21, 0, 5, 0);
    const night = new Date(2026, 9, 21, 23, 50, 0);
    assert.equal(cd.pickCharacter(list, morning), cd.pickCharacter(list, night));
    assert.equal(
      cd.pickCharacter([...list].reverse(), night),
      cd.pickCharacter(list, morning),
    );
  });

  it("troca o personagem no dia seguinte", () => {
    const list = roster(40);
    const cd = new CharacterData();
    const today = cd.pickCharacter(list, new Date(2026, 9, 21, 23, 0, 0));
    const tomorrow = cd.pickCharacter(list, new Date(2026, 9, 22, 0, 10, 0));
    assert.notEqual(today, tomorrow);
  });

  it("não repete ninguém antes de percorrer a lista inteira", () => {
    const list = roster(36);
    const cd = new CharacterData();
    const seen = new Set(picks(cd, list, new Date(2026, 0, 1), list.length));
    assert.equal(seen.size, list.length);
    assert.deepEqual([...seen].sort(), sortedCopy(list));
  });

  it("não segue a ordem alfabética da wiki", () => {
    const list = roster(80);
    const cd = new CharacterData();
    const start = new Date(2026, 0, 1);
    const sequence = picks(cd, list, start, 30);
    const sorted = sortedCopy(list);

    const oldSequential = sequence.map((_, i) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return sorted[cd.mod(cd.calendarDayIndex(date), sorted.length)];
    });
    const matchesOldOrder = sequence.filter((name, i) => name === oldSequential[i]).length;
    assert.ok(matchesOldOrder < 8, `ainda acompanha a ordem da wiki em ${matchesOldOrder} dias`);

    const indexes = sequence.map((name) => sorted.indexOf(name));
    const adjacent = indexes.filter((idx, i) => i > 0 && Math.abs(idx - indexes[i - 1]) === 1).length;
    assert.ok(adjacent <= 4, `dias seguidos ainda são vizinhos na lista (${adjacent})`);

    const ascending = sequence.every((name, i) => i === 0 || sequence[i - 1] <= name);
    const descending = sequence.every((name, i) => i === 0 || sequence[i - 1] >= name);
    assert.equal(ascending, false);
    assert.equal(descending, false);
  });

  it("o passo diário não anda de um em um quando existe outra opção", () => {
    const cd = new CharacterData();
    for (const length of [10, 25, 36, 40, 100, 250, 500]) {
      const step = cd.dailyStep(length);
      assert.equal(cd.gcd(step, length), 1, `passo ${step} não cobre a lista de ${length}`);
      assert.notEqual(step, 1);
      assert.notEqual(step, length - 1);
    }
  });

  it("mantém o calendário contínuo na virada do ano e em 29 de fevereiro", () => {
    const cd = new CharacterData();
    assert.equal(cd.calendarDayIndex(new Date(2020, 0, 1)), 0);
    assert.equal(cd.calendarDayIndex(new Date(2020, 0, 2)), 1);
    assert.equal(
      cd.calendarDayIndex(new Date(2026, 0, 1)) - cd.calendarDayIndex(new Date(2025, 11, 31)),
      1,
    );
    assert.equal(
      cd.calendarDayIndex(new Date(2024, 1, 29)) - cd.calendarDayIndex(new Date(2024, 1, 28)),
      1,
    );
  });

  it("aceita datas anteriores à época sem índice negativo", () => {
    const list = roster(20);
    const cd = new CharacterData();
    const name = cd.pickCharacter(list, new Date(2019, 5, 15));
    assert.ok(list.includes(name));
  });

  it("embaralha de verdade e não reaproveita a ordem de outra lista do mesmo tamanho", () => {
    const cd = new CharacterData();
    const first = cd.getShuffledList(["Ana", "Beatrice", "Crusch", "Emilia"]);
    const second = cd.getShuffledList(["Ram", "Rem", "Subaru", "Wilhelm"]);
    assert.deepEqual([...first].sort(), ["Ana", "Beatrice", "Crusch", "Emilia"]);
    assert.deepEqual([...second].sort(), ["Ram", "Rem", "Subaru", "Wilhelm"]);
    assert.notDeepEqual(first, ["Ana", "Beatrice", "Crusch", "Emilia"]);
  });

  it("lista vazia não escolhe ninguém e lista de um nome é constante", () => {
    const cd = new CharacterData();
    assert.equal(cd.pickCharacter([], new Date(2026, 9, 21)), null);
    assert.equal(cd.pickCharacter(["Emilia"], new Date(2026, 9, 21)), "Emilia");
    assert.equal(cd.pickCharacter(["Emilia"], new Date(2026, 9, 22)), "Emilia");
  });

  it("getDailyCharacter e o personagem de ontem usam o calendário local", async () => {
    const list = roster(30);
    const cd = new CharacterData();
    cd.loadCharacters = async () => list;
    const today = new Date(2026, 9, 21, 18, 0, 0);
    assert.equal(await cd.getCharacterForDay(0, today), cd.pickCharacter(list, today));
    assert.equal(
      await cd.getCharacterForDay(-1, today),
      cd.pickCharacter(list, new Date(2026, 9, 20)),
    );
    assert.equal(await cd.getDailyCharacter(), cd.pickCharacter(list, new Date()));
    assert.equal(
      await cd.getYesterdayCharacter(),
      cd.pickCharacter(list, new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 1)),
    );
  });
});
