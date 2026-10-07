export interface DateTuple {
  departureDate: Date;
  returnDate: Date;
}

export class FlightDateCalculatorService {
  generateDateTuples(
    startDate: Date,
    endDate: Date,
    departureDay: number,
    returnDay: number,
  ): DateTuple[] {
    const tuples: DateTuple[] = [];
    
    const current = new Date(startDate);
    current.setUTCHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);

    while (current <= end) {
      let jsDay = current.getUTCDay();
      let isoDay = jsDay === 0 ? 7 : jsDay;

      if (isoDay === departureDay) {
        let returnDate = new Date(current);
        
        let daysToAdd = returnDay - departureDay;
        if (daysToAdd <= 0) {
          daysToAdd += 7;
        }

        returnDate.setUTCDate(returnDate.getUTCDate() + daysToAdd);

        if (returnDate <= end) {
          tuples.push({
            departureDate: new Date(current),
            returnDate: new Date(returnDate)
          });
        }
      }

      current.setUTCDate(current.getUTCDate() + 1);
    }

    return tuples;
  }
}
