import { movieTriples } from "./example";
import { DB } from "./db";

const db = new DB(movieTriples);

db.when([["?id", "person/born", "?date"]], ({ date, id }) => [
  [id, "person/age", new Date().getFullYear() - new Date(date).getFullYear()],
]);

db.when([["?id", "person/age", "?age"]], ({ id, age }) => {
  if (age >= 60) {
    return [[id, "person/isSenior", true]];
  }
});

db.query(
  [
    ["?id", "person/name", "?name"],
    ["?id", "person/age", "?age"],
    ["?id", "person/isSenior", true],
  ],
  (actors) => {
    console.log(actors);
  }
);
