const fetchWithAuth = require("./index");

test("Tests fetching Json Placeholder via fetchWithAuth", () => {
  return fetchWithAuth("https://jsonplaceholder.typicode.com/todos/1").then(
    (data) => {
      expect(data.title).toBe("delectus aut autem");
    }
  );
});
