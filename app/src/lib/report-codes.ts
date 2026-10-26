// The City's 311 problem codes are abbreviated for a database field, not for a person: a crew
// sees "Illegal dumpg report" on their phone. These are the thirteen codes TipOff keeps, the same
// list as CODES in data/scripts/fetch_311.py, written out in plain words.
//
// "TDebris-alley/street" is undocumented in the City's file; fetch_311.py already treats it as the
// same kind of report as the plain code, so it gets the same label rather than an invented meaning.
const LABELS: Record<string, string> = {
  "Illegal dumpg report": "Illegal dumping",
  "Debris-alley/street": "Debris in an alley or street",
  "TDebris-alley/street": "Debris in an alley or street",
  "Debris-Vacant Lot": "Debris on a vacant lot",
  "Debris-Vacant Bldg": "Debris at a vacant building",
  "Truck dropped litter": "Litter dropped from a truck",
  "Potholes - Residnl": "Pothole on a residential street",
  "Potholes - Major St": "Pothole on a major street",
  "Potholes - Alley": "Pothole in an alley",
  "Graffiti-Private": "Graffiti on private property",
  "Graffiti-Public": "Graffiti on public property",
  "Traffic Graffiti": "Graffiti on a traffic sign or signal",
  "Graffiti-Prvt Dmpstr": "Graffiti on a private dumpster",
};

/**
 * A readable name for a 311 problem code. An unknown code is returned as it came from the City,
 * so a new code shows up as itself rather than silently disappearing or being guessed at.
 */
export function reportLabel(code: string): string {
  return LABELS[code.trim()] ?? code.trim();
}

/** The codes we have a label for. Exported so a test can check it against fetch_311.py. */
export const LABELLED_CODES = Object.keys(LABELS);
