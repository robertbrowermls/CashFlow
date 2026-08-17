import { readFileSync, writeFileSync } from 'fs';
import handlebars from './handlebars';
import { join } from 'path/win32';
import puppeteer, { PDFOptions, SetContentWaitForOptions } from 'puppeteer';
import { logger } from '../index';

function loadHtml(filePath: string): string {
    try {
        return readFileSync(filePath, "utf-8");
    } catch (err) {
        const error = `Error reading HTML file: ${err}`;
        logger.error(error);
        throw new Error(error);
    }
}

export function getHtml(template: string, data: any, path: string, writeFile = true) {
    const cwd = process.cwd();
    const filename = join(cwd, join('app/templates/', template));
    const content = loadHtml(filename);
    const html = handlebars.compile(content)(data);
    if (writeFile) {
        writeFileSync(path, html, 'utf8');
    }
    return html;
};

export async function getPdf(template: string, data: any, pdfOptions: PDFOptions) {
    return new Promise(async (resolve, reject) => {
        const filename = join(__dirname, template);
        const content = loadHtml(filename);
        const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: false });
        const page = await browser.newPage();
        
        const html = handlebars.compile(content)(data);
        const setContentOptions: SetContentWaitForOptions = {
            waitUntil: 'load'
        };
        await page.setContent(html, setContentOptions);
        const pdf = await page.pdf(pdfOptions);
        // await browser.close();
        resolve(pdf);
    });
};

export async function getScreenshot(
    template: string,
    locale: string,
    timeZone: string,
    data: any,
    options: any
): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
        const browser = await puppeteer.launch({
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
            headless: true,
        });
        const page = await browser.newPage();
        const html = handlebars.compile(template)({ data, locale, timeZone });
        const setContentOptions: SetContentWaitForOptions = {
            waitUntil: 'load'
        };
        await page.setContent(html, setContentOptions);
        const screenshot = await page.screenshot(options);
        await browser.close();
        resolve(Buffer.from(screenshot));
    });
}
