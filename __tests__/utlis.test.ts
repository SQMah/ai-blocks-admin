import { expirated, futureDate, sameList, validDateString } from "@/lib/utils";

const VALID_PAST_DATE_STR = "1900-01-01";

const INVALID_DATE_STR = "2000/12/12";

beforeAll(() => {
  console.log("Start tsting utlis functions.");
});

beforeEach(() => {
  console.log(`Testing ${expect.getState().currentTestName} start.`);
});

afterEach(() => {
  console.log(`Testing ${expect.getState().currentTestName} done.`);
});

test("Valid Date String", () => {
  const valid = validDateString(VALID_PAST_DATE_STR);
  expect(valid).toBe(true);
  expect(validDateString(INVALID_DATE_STR)).toBe(false);
});


test("Expirated Date", () => {
  const expire = expirated(VALID_PAST_DATE_STR);
  expect(expire).toBe(true);
});

test("Futrue Date", () => {
  const future = futureDate(0, 1, 0);
  expect(expirated(future)).toBe(false);
});

test("Same List",()=>{
  const arr1 = ["a","b","c"]
  const arr2 = ["b","c","a"]
  const arr3 = ["c","c","b"]
  const arr4 = ["c","c","b","d"]

  expect(sameList(arr1,arr2)).toBeTruthy()
  expect(sameList(arr1,arr3)).not.toBeTruthy()
  expect(sameList(arr1,undefined)).not.toBeTruthy()
  expect(sameList(undefined,arr3)).not.toBeTruthy()
  expect(sameList(arr4,arr2)).not.toBeTruthy()
})

