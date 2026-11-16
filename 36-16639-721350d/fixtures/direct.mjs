import items from "./data.json" with { type: "json" };
console.log(items.map(x => x.toUpperCase()).join(""));
