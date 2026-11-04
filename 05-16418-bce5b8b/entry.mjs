import data from "./data.json" with { type: "json" };

data.run = function () {
  return this.kept;
};

console.log("value=" + data.run());
