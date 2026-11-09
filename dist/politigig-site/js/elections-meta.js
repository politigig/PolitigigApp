/* Election metadata: candidates, certified electoral vote totals, state info. */
window.ELECTIONS = {
  years: ["2008", "2012", "2016", "2020", "2024"],
  races: {
    "2008": { dem: "Barack Obama",    rep: "John McCain",   ev: { dem: 365, rep: 173 } },
    "2012": { dem: "Barack Obama",    rep: "Mitt Romney",   ev: { dem: 332, rep: 206 } },
    "2016": { dem: "Hillary Clinton", rep: "Donald Trump",  ev: { dem: 227, rep: 304 }, note: "7 electors voted for other candidates." },
    "2020": { dem: "Joe Biden",       rep: "Donald Trump",  ev: { dem: 306, rep: 232 } },
    "2024": { dem: "Kamala Harris",   rep: "Donald Trump",  ev: { dem: 226, rep: 312 } }
  },
  // FIPS -> [name, abbr]
  states: {
    "01":["Alabama","AL"],"02":["Alaska","AK"],"04":["Arizona","AZ"],"05":["Arkansas","AR"],"06":["California","CA"],
    "08":["Colorado","CO"],"09":["Connecticut","CT"],"10":["Delaware","DE"],"11":["District of Columbia","DC"],"12":["Florida","FL"],
    "13":["Georgia","GA"],"15":["Hawaii","HI"],"16":["Idaho","ID"],"17":["Illinois","IL"],"18":["Indiana","IN"],"19":["Iowa","IA"],
    "20":["Kansas","KS"],"21":["Kentucky","KY"],"22":["Louisiana","LA"],"23":["Maine","ME"],"24":["Maryland","MD"],
    "25":["Massachusetts","MA"],"26":["Michigan","MI"],"27":["Minnesota","MN"],"28":["Mississippi","MS"],"29":["Missouri","MO"],
    "30":["Montana","MT"],"31":["Nebraska","NE"],"32":["Nevada","NV"],"33":["New Hampshire","NH"],"34":["New Jersey","NJ"],
    "35":["New Mexico","NM"],"36":["New York","NY"],"37":["North Carolina","NC"],"38":["North Dakota","ND"],"39":["Ohio","OH"],
    "40":["Oklahoma","OK"],"41":["Oregon","OR"],"42":["Pennsylvania","PA"],"44":["Rhode Island","RI"],"45":["South Carolina","SC"],
    "46":["South Dakota","SD"],"47":["Tennessee","TN"],"48":["Texas","TX"],"49":["Utah","UT"],"50":["Vermont","VT"],
    "51":["Virginia","VA"],"53":["Washington","WA"],"54":["West Virginia","WV"],"55":["Wisconsin","WI"],"56":["Wyoming","WY"]
  },
  // Electoral votes per state by apportionment (2000 census: 2008; 2010 census: 2012-2020; 2020 census: 2024)
  electors: (function () {
    const base = { AL:9,AK:3,AZ:11,AR:6,CA:55,CO:9,CT:7,DE:3,DC:3,FL:29,GA:16,HI:4,ID:4,IL:20,IN:11,IA:6,KS:6,KY:8,LA:8,ME:4,
      MD:10,MA:11,MI:16,MN:10,MS:6,MO:10,MT:3,NE:5,NV:6,NH:4,NJ:14,NM:5,NY:29,NC:15,ND:3,OH:18,OK:7,OR:7,PA:20,RI:4,SC:9,SD:3,
      TN:11,TX:38,UT:6,VT:3,VA:13,WA:12,WV:5,WI:10,WY:3 };
    const e2008 = Object.assign({}, base, { TX:34,FL:27,GA:15,AZ:10,NV:5,UT:5,SC:8,WA:11,NY:31,OH:20,PA:21,IL:21,MI:17,NJ:15,MA:12,IA:7,LA:9,MO:11 });
    const e2024 = Object.assign({}, base, { TX:40,FL:30,NC:16,CO:10,MT:4,OR:8,CA:54,NY:28,IL:19,MI:15,OH:17,PA:19,WV:4 });
    return { "2008": e2008, "2012": base, "2016": base, "2020": base, "2024": e2024 };
  })()
};
