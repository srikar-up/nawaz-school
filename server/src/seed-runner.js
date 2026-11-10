import { initStore } from './store.js';

const db = initStore({ force: true });
console.log(`Demo database seeded at server/data/db.json`);
console.log(`Revision ${db.meta.revision} · ${db.students.length} students · ${db.staff.length} staff · ${db.timetable.length} timetable periods`);
