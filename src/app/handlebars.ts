import handlebars from "handlebars";
import { getDateTimeFormat, toFixed } from "./helpers";


handlebars.registerHelper("lt", function (a: any, b: any) {
  return a < b;
});

handlebars.registerHelper("lte", function (a: any, b: any) {
  return a <= b;
});

handlebars.registerHelper("gt", function (a: any, b: any) {
  return a > b;
});

handlebars.registerHelper("gte", function (a: any, b: any) {
  return a >= b;
});

handlebars.registerHelper("eq", function (a: any, b: any) {
  return a === b;
});

handlebars.registerHelper("neq", function (a: any, b: any) {
  return a !== b;
});

handlebars.registerHelper("date", function (dateString: string, locale: string, timeZone: string) {
  const dateFormat = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timeZone
  });
  const tempDate = new Date(dateString);
  return dateString && dateFormat.format(tempDate);
});

handlebars.registerHelper("datetime", function (dateString: string, locale: string, timeZone: string) {
  const dateTimeFormat = getDateTimeFormat(locale, timeZone);
  const tempDate = new Date(dateString);
  return dateString && dateTimeFormat.format(tempDate);
});

handlebars.registerHelper("dates", function (from: string, to: string, locale: string, timeZone: string) {
  const dateFormat = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timeZone
  });
  const tempFrom = new Date(from);
  const tempTo = new Date(to);
  return from && to && `${dateFormat.format(tempFrom)} - ${dateFormat.format(tempTo)}`;
});

handlebars.registerHelper("char0", function (s: string) {
  return s.substring(0, 1);
});

handlebars.registerHelper("fixed", function (value: number, decimals: number) {
  return toFixed(value, decimals);
});

handlebars.registerHelper("and", function (value1: any, value2: any) {
  return value1 !== undefined && value1 !== null &&
    value2 !== undefined && value2 !== null;
});

handlebars.registerHelper("def", function (value: any) {
  return value !== undefined && value !== null;
});

handlebars.registerHelper("dec2", function (value: number, locale: string) {
  const numberFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  return numberFormat.format(value);
});

handlebars.registerHelper("rnd2", function (min: number, max: number) {
  return Math.random() * (max - min) + min;
});

handlebars.registerHelper("mul2", function (value1: number, value2: number, locale: string) {
  const numberFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  return numberFormat.format(value1 * value2);
});

handlebars.registerHelper("tot", function (value1: number, value2: number, locale: string) {
  const numberFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  return numberFormat.format(value1 * value2 + value1);
});

export default handlebars;