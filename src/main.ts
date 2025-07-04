import { movieTriples } from "./example";
import { DB } from "./db";

const db = new DB(movieTriples);

db.when([["?id", "person/born", "?date"]], ({ date, id }) => {
  db.assert([
    [id, "person/age", new Date().getFullYear() - new Date(date).getFullYear()],
  ]);
});

console.log(
  db.query([
    ["?id", "person/name", "?name"],
    ["?id", "person/age", "?age"],
  ])
);
