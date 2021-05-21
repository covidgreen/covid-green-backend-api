CREATE TABLE IF NOT EXISTS checkin_summary (
  event_date DATE NOT NULL,
  age TEXT NOT NULL,
  sex TEXT NOT NULL,
  county TEXT NOT NULL,
  town TEXT NOT NULL,
  checkins INT NOT NULL DEFAULT 0,
  PRIMARY KEY (event_date, age, sex, county, town)
);