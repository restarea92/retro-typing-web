/** HTTD.exe's Borland time(NULL), with no DOS TZ environment override.
 * Evidence: getdate/gettime 45d8/45eb, conversion 6e14, tzset 7142,
 * legacy DST 7330 (all original file offsets). This intentionally is NOT
 * the browser's current IANA timezone or modern US daylight-saving rules.
 */
const MONTH_STARTS=[0,31,59,90,120,151,181,212,243,273,304,334,365];
function legacyDaylightSaving(year,month,dayOfYear,hour){
 if(month<4||month>10)return false;
 if(month>4&&month<10)return true;
 const yearSince1970=year-1970;
 // Before1987 the original uses April's last Sunday; from1987 its first.
 let boundary=month===4&&yearSince1970>16?MONTH_STARTS[3]+7:MONTH_STARTS[month];
 if(year%4!==0)boundary--;
 const weekday=(yearSince1970*365+Math.floor((yearSince1970+1)/4)+boundary+4)%7;
 boundary-=weekday;
 return month===4?(dayOfYear>boundary||(dayOfYear===boundary&&hour>=2))
  :(dayOfYear<boundary||(dayOfYear===boundary&&hour<2));
}
/** Convert a DOS local calendar to the original unsigned32-bit time value.
 * Verified calendar range is1980..2099; century-policy guesses are rejected.
 * Default TZ is literally EST5EDT, using the executable's historical rules.
 * Matching actual DOS seeds also requires matching its calendar/TZ setting.
 */
export function originalDosTime({year,month,day,hour=0,minute=0,second=0}){
 if(![year,month,day,hour,minute,second].every(Number.isInteger)||year<1980||year>2099||month<1||month>12||day<1||day>31||hour<0||hour>23||minute<0||minute>59||second<0||second>59)throw new RangeError('Expected a valid DOS calendar in1980..2099');
 const leap=year%4===0,daysInMonth=MONTH_STARTS[month]-MONTH_STARTS[month-1]+(leap&&month===2?1:0);
 if(day>daysInMonth)throw new RangeError('Invalid DOS calendar day');
 const years=year-1980,dayOfYear=MONTH_STARTS[month-1]+day-1+(leap&&month>2?1:0);
 const dst=legacyDaylightSaving(year,month,dayOfYear,hour)?1:0;
 return (315532800+18000+Math.floor(years/4)*126230400+(years%4)*31536000+(years%4?86400:0)+(dayOfYear*24+hour-dst)*3600+minute*60+second)>>>0;
}
/** Same local wall-clock input that DOS receives; no millisecond entropy. */
export function originalBrowserTimeSeed(now=new Date()){
 return originalDosTime({year:now.getFullYear(),month:now.getMonth()+1,day:now.getDate(),hour:now.getHours(),minute:now.getMinutes(),second:now.getSeconds()})&0xffff;
}
