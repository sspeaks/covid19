const fs = require("fs");
const path = require("path");
const parse = require("csv-parse/lib/sync");

const FILENAME_CONFIRMED = "time_series_covid19_confirmed_global.csv";
const FILENAME_DEATHS = "time_series_covid19_deaths_global.csv";
const FILENAME_RECOVERED = "time_series_covid19_recovered_global.csv";
const FILENAME_US_CONFIRMED = "time_series_covid19_confirmed_US.csv";

function extract(filepath) {
  const csv = fs.readFileSync(filepath);
  const [headers, ...rows] = parse(csv);
  const [province, country, lat, long, ...dates] = headers;
  const countList = {};

  // HACK: CSVs have different date formats
  const normalDates = dates.map(date => {
    const [month, day] = date.split("/");
    return `2020-${month}-${day}`;
  });

  rows.forEach(([province, country, lat, long, ...counts]) => {
    countList[country] = countList[country] || {};
    normalDates.forEach((date, i) => {
      countList[country][date] = countList[country][date] || 0;
      countList[country][date] += +counts[i];
    });
  });
  return [countList, normalDates];
}

function extractStates(filepath) {
  const csv = fs.readFileSync(filepath);
  const [headers, ...rows] = parse(csv);
  let [, , , , , , state, , lat, long, , ...dates] = headers;
  const countList = {};

  // HACK: CSVs have different date formats
  const normalDates = dates.map(date => {
    const [month, day] = date.split("/");
    return `2020-${month}-${day}`;
  });

  rows.forEach(([, , , , , , state, , lat, long, , ...counts]) => {
    countList[state] = countList[state] || {};
    normalDates.forEach((date, i) => {
      countList[state][date] = countList[state][date] || 0;
      countList[state][date] += +counts[i];
    });
  });
  return [countList, normalDates];
}

// HACK: Now all the names are the same, but leaving this just in case
const patchCountryNames = {};

function update(dataPath, outputPath) {
  const [confirmed, dates] = extract(
    path.resolve(dataPath, FILENAME_CONFIRMED)
  );
  const [deaths] = extract(path.resolve(dataPath, FILENAME_DEATHS));
  const [recovered] = extract(path.resolve(dataPath, FILENAME_RECOVERED));
  const [states_confirmed, states_dates] = extractStates(path.resolve(dataPath, FILENAME_US_CONFIRMED));
  const countries = Object.keys(confirmed);
  const states = Object.keys(states_confirmed);
  const results = {};
  const statesResults = {};

  states.forEach(state => {
    statesResults[state] = states_dates.map(date => {
      return {
        date,
        confirmed: states_confirmed[state][date]
      };
    });
  });


  countries.forEach(country => {
    // Some country names are different in the recovered dataset
    const recoverdCountry = patchCountryNames[country] || country;

    if (!recovered[recoverdCountry]) {
      console.warn(`${recoverdCountry} is missing from the recovered dataset`);
    }

    results[country] = dates.map(date => {
      return {
        date,
        confirmed: confirmed[country][date],
        deaths: deaths[country][date],
        recovered:
          recovered[recoverdCountry] && recovered[recoverdCountry][date] != null
            ? recovered[recoverdCountry][date]
            : null
      };
    });
  });

  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  fs.writeFileSync(outputPath.split('.json').join('_states.json'), JSON.stringify(statesResults, null, 2));
}

module.exports = update;
