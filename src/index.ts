import csv from 'csvtojson';
import fs from 'fs';
import { forkJoin, from, Observable, Subject } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';

interface CSVFile {
  fileName: string;
  name: string;
  date: Date;
}

interface LineItem {
  name: string;
  amount: number;
  price: number;
}
interface Bill {
  date: Date;
  name: string;
  lineItems: LineItem[];
  total: number;
}
interface CsvParserOptions {
  inputDirectory: string;
  csvFile: CSVFile;
}

function getCSVFiles$(path: string): Observable<CSVFile[]> {
  const subj = new Subject<string[]>();
  fs.readdir(path, (err, files) => {
    if (err) {
      subj.error(err);
    } else {
      subj.next(files);
    }
  });
  function splitBySeparator(filename: string, separator: string = '_'): string[] {
    return filename
      .split('.')[0] // get rid of file ending
      .split(separator);
  }
  return subj.pipe(
    map((rawNames) =>
      rawNames.map((fileName) => {
        const [date, name] = splitBySeparator(fileName);
        return {
          fileName,
          name,
          date: new Date(Date.parse(date)),
        };
      })
    )
  );
}

function parseCSV$(options: CsvParserOptions): Observable<Bill> {
  return from(
    csv()
      .fromFile(`${options.inputDirectory}/${options.csvFile.fileName}`)
      .then((lineItems) => lineItems)
  ).pipe(
    map((lineItems: any[]) =>
      lineItems.map(
        (item) =>
          ({
            name: item.name,
            amount: parseInt(item.amount, 10),
            price: parseFloat(item.price),
            taxRate: parseFloat(item.taxRate),
          } as LineItem)
      )
    ),
    map((lineItems) => ({
      date: options.csvFile.date,
      name: options.csvFile.name,
      lineItems,
      total: lineItems.reduce((total, item) => total + item.price, 0),
    }))
  );
}

function buildMarkdownTable(bills: Bill[]) {
  const header = `Position | Amount | Price\n---------|--------|-------\n`;
  bills
    .map(
      (bill) =>
        `## ${bill.name} ${bill.total}\n` +
        header +
        bill.lineItems.map((item) => `${item.name} | ${item.amount} | ${item.price}`).join('\n') +
        '\n\n'
    )
    // tslint:disable-next-line: no-console
    .forEach((md) => fs.appendFile('tables.md', md, (err) => err && console.error('Error: ', err)));
}

getCSVFiles$('./csv')
  .pipe(mergeMap((csvFiles) => forkJoin(csvFiles.map((csvFile) => parseCSV$({ inputDirectory: './csv', csvFile })))))
  .subscribe(buildMarkdownTable);
