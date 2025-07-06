import { DB } from "./db";
import { defineField, $ } from "./pattern";

const hasName = defineField<string>("person/name");
const hasBirthDate = defineField<string>("person/born");
const hasAge = defineField<number>("person/age");
const isSenior = defineField<boolean>("person/isSenior");

const db = new DB([
  [1, hasName("Alice")],
  [1, hasBirthDate("1990-01-01")],
  [2, hasName("Bob")],
  [2, hasBirthDate("1960-01-01")],
]);

db.when([[$("id"), hasBirthDate.$("date")]], ({ id, date }) => {
  const age = new Date().getFullYear() - new Date(date).getFullYear();
  return [[id, hasAge(age)]];
});

db.when([[$("id"), hasAge.$("age")]], ({ id, age }) => {
  return [[id, isSenior(age >= 60)]];
});

console.log(db.statements());

db.query(
  [
    [$("id"), hasName.$("name")],
    [$("id"), isSenior(true)],
  ],
  (matches) => {
    console.log(
      "seniors",
      matches.map(({ name }) => ({ name }))
    );
  }
);
