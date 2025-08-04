import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import puppeteer from 'puppeteer';
import pdfPrinter from 'pdf-to-printer';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PrintingService {
    constructor() {
        this.defaultPrinter = null;
        this.availablePrinters = [];
        this.initializePrinters();
    }

    async initializePrinters() {
        try {
            await this.refreshPrinters();
        } catch (error) {
            console.error('❌ Failed to initialize printers:', error);
            this.availablePrinters = [];
        }
    }

    async refreshPrinters() {
        try {
            if (this.availablePrinters.length === 0) {
                await this.discoverPrinters();
            }
        } catch (error) {
            console.error('❌ Failed to refresh printers:', error);
            throw error;
        }
    }

    async discoverPrinters() {
        try {
            let command;
            if (process.platform === 'win32') {
                command = 'wmic printer list brief /format:csv';
            } else if (process.platform === 'darwin') {
                command = 'lpstat -p';
            } else {
                command = 'lpstat -p';
            }

            const { stdout } = await execAsync(command);
            this.availablePrinters = this.parsePrinterOutput(stdout);
            if (process.platform === 'win32') {
                try {
                    const { stdout: defaultOut } = await execAsync('wmic printer where default=true get name /format:csv');
                    const lines = defaultOut.split('\n').filter(line => line.trim() && !line.includes('Node,Name'));
                    if (lines.length > 0) {
                        this.defaultPrinter = lines[0].split(',')[1]?.trim();
                    }
                } catch (error) {
                    console.warn('Could not get default printer:', error.message);
                }
            } else {
                try {
                    const { stdout: defaultOut } = await execAsync('lpstat -d');
                    const match = defaultOut.match(/system default destination: (.+)/);
                    if (match) {
                        this.defaultPrinter = match[1].trim();
                    }
                } catch (error) {
                    console.warn('Could not get default printer:', error.message);
                }
            }

            console.log('🖨️ Available printers:', this.availablePrinters.map(p => p.name));
            console.log('🖨️ Default printer:', this.defaultPrinter);
        } catch (error) {
            console.error('❌ Failed to discover printers:', error);
            throw error;
        }
    }

    parsePrinterOutput(output) {
        const printers = [];

        if (process.platform === 'win32') {
            const lines = output.split('\n').filter(line => line.trim() && !line.includes('Node,Name'));
            lines.forEach(line => {
                const parts = line.split(',');
                if (parts.length >= 2) {
                    const name = parts[1]?.trim();
                    if (name) {
                        printers.push({
                            name: name,
                            displayName: name,
                            isDefault: name === this.defaultPrinter,
                            status: 'available'
                        });
                    }
                }
            });
        } else {
            const lines = output.split('\n').filter(line => line.trim());
            lines.forEach(line => {
                const match = line.match(/printer (.+?) is/);
                if (match) {
                    const name = match[1];
                    printers.push({
                        name: name,
                        displayName: name,
                        isDefault: name === this.defaultPrinter,
                        status: line.includes('disabled') ? 'disabled' : 'available'
                    });
                }
            });
        }

        return printers;
    }

    getPrinters() {
        return {
            availablePrinters: this.availablePrinters,
            defaultPrinter: this.defaultPrinter
        };
    }

    async refreshPrintersFromAPI() {
        await this.discoverPrinters();
        return this.getPrinters();
    }

    async printBalloonDelivery(deliveryData, printConfig = {}) {
        try {
            const {
                template = 'basic',
                printerName = this.defaultPrinter,
                includeQRCode = false
            } = printConfig;
            const htmlContent = this.generatePrintHTML(deliveryData, template, includeQRCode);

            const tempPdfPath = path.join(__dirname, 'temp', `balloon_${Date.now()}.pdf`);
            const tempDir = path.dirname(tempPdfPath);
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }


            await this.generatePDF(htmlContent, tempPdfPath);


            const result = await this.printPdfFile(tempPdfPath, printerName);


            setTimeout(() => {
                try {
                    if (fs.existsSync(tempPdfPath)) {
                        fs.unlinkSync(tempPdfPath);
                    }
                } catch (error) {
                    console.warn('⚠️ Failed to clean up temp file:', error);
                }
            }, 10000);

            return result;
        } catch (error) {
            console.error('❌ Print error:', error);
            throw error;
        }
    }

    async generatePDF(htmlContent, outputPath) {
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const page = await browser.newPage();
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
            await page.pdf({
                path: outputPath,
                width: '51mm',
                height: '51mm',
                margin: {
                    top: '5mm',
                    right: '5mm',
                    bottom: '5mm',
                    left: '5mm'
                },
                printBackground: true
            });

            console.log('✅ PDF generated successfully:', outputPath);
        } catch (error) {
            console.error('❌ PDF generation error:', error);
            throw error;
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    async printPdfFile(filePath, printerName) {
        return new Promise((resolve, reject) => {
            const selectedPrinter = printerName || this.defaultPrinter;

            if (!selectedPrinter) {
                reject(new Error('No printer available'));
                return;
            }

            try {
                if (process.platform === 'win32') {
                    this.printPdfViaWindows(filePath, selectedPrinter)
                        .then(resolve)
                        .catch(reject);
                } else {
                    this.printPdfViaLp(filePath, selectedPrinter)
                        .then(resolve)
                        .catch(reject);
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    async printPdfViaWindows(filePath, printerName) {
        try {
            console.log('🖨️ Attempting to print PDF via pdf-to-printer package...');

            const options = {
                printer: printerName,
                paperSize: 'A4',
                scale: 'fit'
            };

            await pdfPrinter.print(filePath, options);
            console.log('✅ PDF printed successfully via pdf-to-printer');
            return { success: true, printer: printerName };

        } catch (error) {
            console.log('⚠️ pdf-to-printer failed, trying fallback methods...');
            try {
                const sumatraCommand = `powershell -Command "if (Test-Path 'C:\\Program Files\\SumatraPDF\\SumatraPDF.exe') { Start-Process 'C:\\Program Files\\SumatraPDF\\SumatraPDF.exe' -ArgumentList '-print-to','${printerName}','${filePath}' -WindowStyle Hidden -Wait; exit 0 } else { throw 'SumatraPDF not found' }"`;
                await execAsync(sumatraCommand);
                console.log('✅ PDF printed successfully via SumatraPDF fallback');
                return { success: true, printer: printerName };
            } catch (sumatraError) {
                console.log('ℹ️ SumatraPDF fallback failed');
            }
            try {
                const adobePaths = [
                    'C:\\Program Files\\Adobe\\Acrobat DC\\Acrobat\\AcroRd32.exe',
                    'C:\\Program Files (x86)\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe',
                    'C:\\Program Files\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe'
                ];

                for (const adobePath of adobePaths) {
                    try {
                        const adobeCommand = `powershell -Command "if (Test-Path '${adobePath}') { Start-Process '${adobePath}' -ArgumentList '/t','${filePath}','${printerName}' -WindowStyle Hidden -Wait; exit 0 } else { throw 'Adobe not found at this path' }"`;
                        await execAsync(adobeCommand);
                        console.log('✅ PDF printed successfully via Adobe Reader fallback');
                        return { success: true, printer: printerName };
                    } catch (adobeError) {
                        continue;
                    }
                }

                throw new Error('No Adobe Reader installation found');
            } catch (adobeError) {
                console.log('ℹ️ Adobe Reader fallback failed');
            }

            throw new Error(`All Windows PDF printing methods failed. Original error: ${error.message}`);
        }
    }

    async printPdfViaLp(filePath, printerName) {
        try {
            const printCommand = `lp -d "${printerName}" "${filePath}"`;

            return new Promise((resolve, reject) => {
                exec(printCommand, (error, stdout, stderr) => {
                    if (error) {
                        console.error('❌ PDF print command error:', error);
                        reject(error);
                    } else {
                        console.log('✅ PDF printed successfully via lp');
                        resolve({ success: true, printer: printerName });
                    }
                });
            });
        } catch (error) {
            throw new Error(`Failed to print PDF via lp: ${error.message}`);
        }
    }

    generatePrintHTML(data, template, includeQRCode) {
        const balloonCount = data.isFirstACInContest ? 3 : data.isFirstSolve ? 2 : 1;
        const baseStyles = `
            <style>
                @page {
                    margin: 15mm;
                    size: A4;
                }
                @media print {
                    body { margin: 0; }
                    .no-print { display: none; }
                }
                body { 
                    font-family: 'Arial', sans-serif; 
                    margin: 0;
                    padding: 15px;
                    color: #333;
                    line-height: 1.4;
                }
                .header { 
                    text-align: center; 
                    margin-bottom: 25px; 
                    border-bottom: 3px solid #333;
                    padding-bottom: 15px;
                    background: linear-gradient(45deg, #f8f9fa, #e9ecef);
                    border-radius: 10px;
                    padding: 20px;
                }
                .delivery-info { 
                    border: 3px solid #333; 
                    padding: 20px; 
                    border-radius: 15px;
                    background: #fff;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                }
                .problem-color { 
                    width: 50px; 
                    height: 50px; 
                    display: inline-block; 
                    border-radius: 50%; 
                    margin-right: 15px;
                    border: 3px solid #333;
                    vertical-align: middle;
                }
                .badges { 
                    margin: 20px 0; 
                    text-align: center;
                }
                .badge { 
                    display: inline-block;
                    padding: 12px 20px; 
                    border-radius: 25px; 
                    margin: 5px 10px; 
                    font-weight: bold;
                    font-size: 16px;
                    border: 2px solid;
                }
                .first-solve { 
                    background: #ffc107; 
                    color: #000; 
                    border-color: #e0a800;
                    box-shadow: 0 3px 6px rgba(255, 193, 7, 0.3);
                }
                .first-ac { 
                    background: #dc3545; 
                    color: white; 
                    border-color: #c82333;
                    box-shadow: 0 3px 6px rgba(220, 53, 69, 0.3);
                }
                .regular-badge { 
                    background: #007bff; 
                    color: white; 
                    border-color: #0056b3;
                    box-shadow: 0 3px 6px rgba(0, 123, 255, 0.3);
                }
                .stats-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                    margin: 20px 0;
                }
                .stat-box {
                    padding: 15px;
                    border: 2px solid #ddd;
                    border-radius: 10px;
                    background: #f8f9fa;
                    text-align: center;
                }
                .stat-value {
                    font-size: 24px;
                    font-weight: bold;
                    color: #007bff;
                    margin-bottom: 5px;
                }
                .stat-label {
                    font-size: 14px;
                    color: #666;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
            </style>
        `;

        if (template === 'detailed') {
            return `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Balloon Delivery Receipt - ${data.team}</title>
                    <link rel="stylesheet" href="style.css" type="text/css" media="all" />
                    ${baseStyles}
                    <style>
                        .team-section { 
                            background: linear-gradient(135deg, #f8f9fa, #e3f2fd); 
                            padding: 25px; 
                            border-radius: 15px; 
                            margin: 20px 0; 
                            border: 3px solid #007bff;
                            box-shadow: 0 4px 12px rgba(0, 123, 255, 0.2);
                        }
                        .problem-section { 
                            display: flex; 
                            align-items: center; 
                            margin: 25px 0; 
                            padding: 25px; 
                            background: linear-gradient(135deg, #fff3cd, #ffeaa7); 
                            border-radius: 15px;
                            border: 3px solid #dc3545;
                            box-shadow: 0 4px 12px rgba(220, 53, 69, 0.2);
                        }
                        .problem-details { 
                            flex: 1; 
                            margin-left: 20px; 
                        }
                        .delivery-section { 
                            background: linear-gradient(135deg, #d4edda, #a8e6a1); 
                            padding: 25px; 
                            border-radius: 15px; 
                            margin: 20px 0; 
                            border: 3px solid #28a745;
                            box-shadow: 0 4px 12px rgba(40, 167, 69, 0.2);
                        }
                        .qr-section { 
                            text-align: center; 
                            margin: 25px 0; 
                            padding: 20px;
                            border: 3px dashed #333;
                            border-radius: 15px;
                            background: #f8f9fa;
                        }
                        .timestamp {
                            text-align: center;
                            font-size: 14px;
                            color: #666;
                            margin-top: 25px;
                            padding: 15px;
                            border-top: 2px solid #ddd;
                            background: #f8f9fa;
                            border-radius: 10px;
                        }
                        .contest-info {
                            background: linear-gradient(135deg, #e1f5fe, #b3e5fc);
                            padding: 20px;
                            border-radius: 15px;
                            margin: 20px 0;
                            border: 2px solid #039be5;
                        }
                        .submission-details {
                            background: linear-gradient(135deg, #fce4ec, #f8bbd9);
                            padding: 20px;
                            border-radius: 15px;
                            margin: 20px 0;
                            border: 2px solid #e91e63;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1 style="font-size: 36px; margin: 0; color: #333;">🎈 BALLOON DELIVERY RECEIPT</h1>
                        <p style="font-size: 18px; color: #666; margin: 10px 0;">Programming Contest Management System</p>
                        <p style="font-size: 16px; color: #666; margin: 5px 0;">${new Date().toLocaleString()}</p>
                    </div>
                    
                    <div class="delivery-info">
                        <div class="team-section">
                            <h2 style="margin: 0 0 15px 0; color: #007bff; font-size: 24px;">🏆 TEAM INFORMATION</h2>
                            <div style="text-align: center; margin: 20px 0;">
                                <div style="font-size: 42px; font-weight: bold; margin: 10px 0; color: #333;">${data.team}</div>
                                <div style="font-size: 64px; font-weight: bold; color: #007bff; margin: 15px 0; text-align: center; border: 4px solid #007bff; padding: 20px; border-radius: 15px; background: rgba(0, 123, 255, 0.1);">
                                    TEAM ID: ${data.teamId}
                                </div>
                            </div>
                            
                            <div class="stats-grid">
                                <div class="stat-box">
                                      <div class="stat-value">X${balloonCount || '1'}</div>
                                    <div class="stat-label">Balloon Count</div>
                                     <div class="problem-color" style="width: 80px; height: 80px; margin-top: 10px;"><h1>X${balloonCount || '1'}</h1></div>
                                </div>
                                <div class="stat-box" style="display: flex; flex-direction: column; align-items: center;">
                                    <div class="stat-value">${data.problemColor || '#000000'}</div>
                                    <div class="stat-label">Balloon Color</div>
                                    <div class="problem-color" style="background-color: ${data.problemRgb || '#000000'}; width: 80px; height: 80px; margin-top: 10px;"></div>
                                </div>
                            </div>
                        </div>
       
                        <div class="timestamp">
                            <strong>Official Delivery Receipt</strong><br>
                            Generated: ${new Date().toLocaleString()}<br>
                            System: Balloon Management v2.0<br>
                            Document ID: ${data.teamId}-${data.problemLetter}-${Date.now()}
                        </div>
                    </div>
                </body>
                </html>
            `;
        } else {
            return `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Balloon Delivery Receipt - ${data.team}</title>
                    <link rel="stylesheet" href="style.css" type="text/css" media="all" />
                    ${baseStyles}
                    <style>
                        .team-section { 
                            background: linear-gradient(135deg, #f8f9fa, #e3f2fd); 
                            padding: 25px; 
                            border-radius: 15px; 
                            margin: 20px 0; 
                            border: 3px solid #007bff;
                            box-shadow: 0 4px 12px rgba(0, 123, 255, 0.2);
                        }
                        .timestamp {
                            text-align: center;
                            font-size: 14px;
                            color: #666;
                            margin-top: 25px;
                            padding: 15px;
                            border-top: 2px solid #ddd;
                            background: #f8f9fa;
                            border-radius: 10px;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1 style="font-size: 36px; margin: 0; color: #333;">🎈 BALLOON DELIVERY RECEIPT</h1>
                        <p style="font-size: 18px; color: #666; margin: 10px 0;">Programming Contest Management System</p>
                        <p style="font-size: 16px; color: #666; margin: 5px 0;">${new Date().toLocaleString()}</p>
                    </div>
                    
                    <div class="delivery-info">
                        <div class="team-section">
                            <h2 style="margin: 0 0 15px 0; color: #007bff; font-size: 24px;">🏆 TEAM INFORMATION</h2>
                            <div style="text-align: center; margin: 20px 0;">
                                <div style="font-size: 42px; font-weight: bold; margin: 10px 0; color: #333;">${data.team}</div>
                                <div style="font-size: 64px; font-weight: bold; color: #007bff; margin: 15px 0; text-align: center; border: 4px solid #007bff; padding: 20px; border-radius: 15px; background: rgba(0, 123, 255, 0.1);">
                                    TEAM ID: ${data.teamId}
                                </div>
                            </div>
                            
                            <div class="stats-grid">
                                <div class="stat-box">
                                    <div class="stat-value">X${balloonCount || '1'}</div>
                                    <div class="stat-label">Balloon Count</div>
                                     <div class="problem-color" style="width: 80px; height: 80px; margin-top: 10px;"><h1>X${balloonCount || '1'}</h1></div>
                                </div>
                                <div class="stat-box" style="display: flex; flex-direction: column; align-items: center;">
                                    <div class="stat-value">${data.problemColor || '#000000'}</div>
                                    <div class="stat-label">Balloon Color</div>
                                    <div class="problem-color" style="background-color: ${data.problemRgb || '#000000'}; width: 80px; height: 80px; margin-top: 10px;"></div>
                                </div>
                            </div>
                        </div>
       
                        <div class="timestamp">
                            <strong>Official Delivery Receipt</strong><br>
                            Generated: ${new Date().toLocaleString()}<br>
                            System: Balloon Management v2.0<br>
                            Document ID: ${data.teamId}-${data.problemLetter}-${Date.now()}
                        </div>
                    </div>
                </body>
                </html>
            `;
        }
    }
}

export default PrintingService;
