import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { parseOptions } from './options.js';
import { projectRoot } from './paths.js';

const source = join(projectRoot(), 'config', 'options.json');

test('starter config includes MEC-153, MEC-163, and editable instructors', () => {
  const options = parseOptions(readFileSync(source, 'utf8'), source);
  const classIds = options.classes.map((item) => item.id);
  assert.ok(classIds.includes('MEC-153'));
  assert.ok(classIds.includes('MEC-163'));
  assert.equal(options.classes.find((item) => item.id === 'MEC-153')?.label, 'MEC-153 Fundamentals of PLC');
  assert.equal(options.classes.find((item) => item.id === 'MEC-163')?.label, 'MEC-163 Applications of PLC');
  assert.deepEqual(
    options.instructors.map((item) => item.label),
    [
      'Robert M. Fricke',
      'Thomas Clark',
      'Hazem Diab',
      'Shawn Patrick Doyle',
      'Joshua P. Gates',
      'Lucas Greenlee',
      'Jill L. Jennings',
      'Collin James Ruthe (Manufacturing Technology Coordinator)',
      'Thomas C. Tammen',
      'David V. Wedwick',
      'Norb L. Ziemer',
    ],
  );
  assert.equal(
    options.instructors.some((item) =>
      /Alex Morgan|Jordan Lee|Sam Patel|Harin Patel|Michael Baum|Maruti Gudavalli|Ted Ray Schnetker|Michael J\. Kelly|Trey M\. Degner|Harvey Watts|Ira Haugen|Kevin M\. Conery|James A\. Harder/.test(
        item.label,
      ),
    ),
    false,
  );
  assert.deepEqual(
    options.labs.map((item) => item.label),
    [
      'Hydraulics/Pneumatics',
      'Amatrol Motor Control Systems',
      'Mechanical Drives',
      'Robotics',
      'AC/DC',
      'PLC',
    ],
  );
  assert.equal(options.timezone, 'America/Chicago');
  assert.equal(options.privacyNote, '');
});

test('config rejects duplicate class ids and comments', () => {
  const options = parseOptions(readFileSync(source, 'utf8'), source);
  const broken = {
    ...options,
    classes: [
      { id: 'MEC-153', label: 'MEC-153 Fundamentals of PLC' },
      { id: 'MEC-153', label: 'Duplicate' },
    ],
  };
  assert.throws(() => parseOptions(JSON.stringify(broken)), /duplicate classes id/);
  assert.throws(() => parseOptions('{ classes: true }'), /not valid JSON/);
});
