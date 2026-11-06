import test from 'node:test';
import assert from 'node:assert/strict';

import {
  actualMidiFor,
  diatonicStepFor,
  buildPositions,
  describeDiatonicStep,
  describeStaffPosition,
  ledgerLinesFor,
  makeNote,
  positionsForWrittenMidi,
  spellPitch,
  staffLineForStep,
  writtenMidiFor,
} from '../js/music.js';

const OPEN_AND_THIRD = [
  // string, fret, actual midi, written midi, written name
  [1, 0, 64, 76, 'E5'],
  [1, 3, 67, 79, 'G5'],
  [2, 0, 59, 71, 'B4'],
  [2, 3, 62, 74, 'D5'],
  [3, 0, 55, 67, 'G4'],
  [3, 3, 58, 70, 'A♯4'],
  [4, 0, 50, 62, 'D4'],
  [4, 3, 53, 65, 'F4'],
  [5, 0, 45, 57, 'A3'],
  [5, 3, 48, 60, 'C4'],
  [6, 0, 40, 52, 'E3'],
  [6, 3, 43, 55, 'G3'],
];

test('每根弦的空弦与第 3 品：实际音高、谱上音高和音名', () => {
  for (const [string, fret, actual, written, name] of OPEN_AND_THIRD) {
    assert.equal(actualMidiFor(string, fret), actual, `第 ${string} 弦 ${fret} 品实际音高`);
    assert.equal(writtenMidiFor(string, fret), written, `第 ${string} 弦 ${fret} 品谱上音高`);
    const note = makeNote(string, fret, 'sharp');
    assert.equal(note.pitch.midi, written);
    assert.equal(note.pitch.fullName, name, `第 ${string} 弦 ${fret} 品音名`);
  }
});

test('吉他谱上音高恒等于实际音高 + 12', () => {
  for (let string = 1; string <= 6; string += 1) {
    for (let fret = 0; fret <= 12; fret += 1) {
      assert.equal(writtenMidiFor(string, fret) - actualMidiFor(string, fret), 12);
    }
  }
});

test('固定唱名与升降号拼写', () => {
  assert.deepEqual(
    [60, 62, 64, 65, 67, 69, 71].map((midi) => spellPitch(midi).solfege),
    ['do', 're', 'mi', 'fa', 'sol', 'la', 'si'],
  );
  assert.equal(spellPitch(70, 'sharp').name, 'A♯');
  assert.equal(spellPitch(70, 'sharp').solfege, 'la♯');
  assert.equal(spellPitch(70, 'flat').name, 'B♭');
  assert.equal(spellPitch(70, 'flat').solfege, 'si♭');
  assert.equal(spellPitch(70, 'sharp').vexKey, 'a#/4');
  assert.equal(spellPitch(70, 'flat').vexKey, 'bb/4');
});

test('同一个 MIDI 在升号/降号模式下谱面位置不同', () => {
  const sharp = spellPitch(61, 'sharp'); // C♯4
  const flat = spellPitch(61, 'flat'); // D♭4
  assert.equal(sharp.name, 'C♯');
  assert.equal(flat.name, 'D♭');
  assert.equal(sharp.diatonicStep, 28, 'C♯4 与 C4 同一线间');
  assert.equal(flat.diatonicStep, 29, 'D♭4 与 D4 同一线间');
  assert.notEqual(sharp.vexKey, flat.vexKey);
  assert.equal(sharp.vexKey, 'c#/4');
  assert.equal(flat.vexKey, 'db/4');
  // 同音异位：⑤弦 4 品在两种写法下 MIDI 相同、位置不同
  const sharpNote = makeNote(5, 4, 'sharp');
  const flatNote = makeNote(5, 4, 'flat');
  assert.equal(sharpNote.writtenMidi, flatNote.writtenMidi);
  assert.notEqual(sharpNote.pitch.diatonicStep, flatNote.pitch.diatonicStep);
});

test('低音弦需要正确的下加线', () => {
  const lowE = makeNote(6, 0); // 谱上 E3
  assert.equal(lowE.pitch.fullName, 'E3');
  assert.equal(lowE.pitch.diatonicStep, 23);
  assert.equal(describeStaffPosition(52), '下加三线下方间');
  assert.deepEqual(ledgerLinesFor(lowE.pitch.diatonicStep), {
    count: 3,
    direction: 'below',
    lines: [28, 26, 24],
  });
  assert.equal(staffLineForStep(23), 7.5);

  // 5 弦 3 品：谱上中央 C4，第一条下加线
  const middleC = makeNote(5, 3);
  assert.equal(middleC.pitch.fullName, 'C4');
  assert.equal(describeStaffPosition(60), '下加一线');
  assert.equal(ledgerLinesFor(middleC.pitch.diatonicStep).count, 1);

  // 4 弦空弦 D4：谱表下方间，不需要加线
  assert.equal(describeStaffPosition(62), '第一线下方间');
  assert.equal(ledgerLinesFor(diatonicStepFor(62)).count, 0);
});

test('高音区与五线内的位置描述', () => {
  assert.equal(describeStaffPosition(64), '第一线');
  assert.equal(describeStaffPosition(65), '第一间');
  assert.equal(describeStaffPosition(67), '第二线');
  assert.equal(describeStaffPosition(71), '第三线');
  assert.equal(describeStaffPosition(74), '第四线');
  assert.equal(describeStaffPosition(77), '第五线');
  assert.equal(describeStaffPosition(79), '第五线上方间');
  assert.equal(describeStaffPosition(81), '上加一线');
  assert.equal(describeStaffPosition(88), '上加三线');
  assert.equal(ledgerLinesFor(diatonicStepFor(81)).count, 1);
  assert.equal(ledgerLinesFor(diatonicStepFor(88)).count, 3);
});

test('同一个谱面音高能找出多个指板位置', () => {
  // 谱上 A3（实际 A2）在 6 弦 5 品与 5 弦空弦
  const positions = positionsForWrittenMidi(57, {
    strings: [1, 2, 3, 4, 5, 6],
    frets: Array.from({ length: 13 }, (_, index) => index),
  });
  assert.deepEqual(
    positions.map((position) => `${position.string}:${position.fret}`).sort(),
    ['5:0', '6:5'],
  );
});

test('第一把位自然音池的数量与音名', () => {
  const high = buildPositions({ strings: [1, 2, 3], frets: [0, 1, 2, 3], naturalsOnly: true });
  const low = buildPositions({ strings: [4, 5, 6], frets: [0, 1, 2, 3], naturalsOnly: true });
  const all = buildPositions({ strings: [1, 2, 3, 4, 5, 6], frets: [0, 1, 2, 3] });
  assert.equal(high.length, 8);
  assert.equal(low.length, 9);
  assert.equal(all.length, 24);
  assert.ok([...high, ...low].every((note) => note.pitch.isNatural));
  assert.equal(new Set([...high, ...low].map((note) => note.writtenMidi)).size, 17);
});

test('非法弦号/品位会被拒绝', () => {
  assert.throws(() => actualMidiFor(0, 0), RangeError);
  assert.throws(() => actualMidiFor(7, 0), RangeError);
  assert.throws(() => actualMidiFor(1, -1), RangeError);
  assert.throws(() => actualMidiFor(1, 1.5), RangeError);
});

test('Diatonic step 描述覆盖加线上下方间', () => {
  assert.equal(describeDiatonicStep(28), '下加一线');
  assert.equal(describeDiatonicStep(27), '下加一线下方间');
  assert.equal(describeDiatonicStep(26), '下加二线');
  assert.equal(describeDiatonicStep(24), '下加三线');
  assert.equal(describeDiatonicStep(39), '第五线上方间');
  assert.equal(describeDiatonicStep(40), '上加一线');
  assert.equal(describeDiatonicStep(41), '上加一间');
  assert.equal(describeDiatonicStep(42), '上加二线');
});
