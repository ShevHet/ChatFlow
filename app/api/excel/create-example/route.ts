import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

export async function POST() {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const data = [
      ['Name', 'Email', 'Department', 'Salary', 'Bonus', 'Total'],
      ['John Smith', 'john.smith@example.com', 'Engineering', 75000, 5000, { f: 'D2+E2' }],
      ['Jane Doe', 'jane.doe@example.com', 'Marketing', 65000, 4000, { f: 'D3+E3' }],
      ['Bob Johnson', 'bob.johnson@example.com', 'Sales', 70000, 8000, { f: 'D4+E4' }],
      ['Alice Williams', 'alice.williams@example.com', 'Engineering', 80000, 6000, { f: 'D5+E5' }],
      ['Charlie Brown', 'charlie.brown@example.com', 'HR', 55000, 3000, { f: 'D6+E6' }],
      ['Diana Prince', 'diana.prince@example.com', 'Engineering', 90000, 10000, { f: 'D7+E7' }],
      ['Edward Norton', 'edward.norton@example.com', 'Finance', 72000, 5500, { f: 'D8+E8' }],
      ['Fiona Green', 'fiona.green@example.com', 'Marketing', 62000, 3500, { f: 'D9+E9' }],
      ['George White', 'george.white@example.com', 'Sales', 68000, 7500, { f: 'D10+E10' }],
      ['Helen Black', 'helen.black@example.com', 'Engineering', 85000, 7000, { f: 'D11+E11' }],
      ['', '', 'TOTAL:', { f: 'SUM(D2:D11)' }, { f: 'SUM(E2:E11)' }, { f: 'SUM(F2:F11)' }],
      ['', '', 'AVERAGE:', { f: 'AVERAGE(D2:D11)' }, { f: 'AVERAGE(E2:E11)' }, { f: 'AVERAGE(F2:F11)' }],
      ['', '', 'MAX:', { f: 'MAX(D2:D11)' }, { f: 'MAX(E2:E11)' }, { f: 'MAX(F2:F11)' }],
      ['', '', 'MIN:', { f: 'MIN(D2:D11)' }, { f: 'MIN(E2:E11)' }, { f: 'MIN(F2:F11)' }],
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      { wch: 18 },
      { wch: 30 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');

    const productsData = [
      ['Product', 'Category', 'Price', 'Quantity', 'Subtotal'],
      ['Laptop', 'Electronics', 999.99, 5, { f: 'C2*D2' }],
      ['Mouse', 'Electronics', 29.99, 20, { f: 'C3*D3' }],
      ['Keyboard', 'Electronics', 79.99, 15, { f: 'C4*D4' }],
      ['Monitor', 'Electronics', 299.99, 8, { f: 'C5*D5' }],
      ['Desk Chair', 'Furniture', 199.99, 10, { f: 'C6*D6' }],
      ['Standing Desk', 'Furniture', 499.99, 3, { f: 'C7*D7' }],
      ['Notebook', 'Office', 4.99, 100, { f: 'C8*D8' }],
      ['Pen Set', 'Office', 12.99, 50, { f: 'C9*D9' }],
      ['', '', '', 'TOTAL:', { f: 'SUM(E2:E9)' }],
    ];

    const ws2 = XLSX.utils.aoa_to_sheet(productsData);
    ws2['!cols'] = [
      { wch: 15 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws2, 'Products');

    const filePath = path.join(dataDir, 'example.xlsx');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    fs.writeFileSync(filePath, buffer);

    return NextResponse.json({
      success: true,
      path: filePath,
      sheets: ['Employees', 'Products'],
      message: 'Created example.xlsx with employee data and product inventory',
    });
  } catch (error) {
    console.error('Error creating example.xlsx:', error);
    return NextResponse.json(
      { error: 'Failed to create example.xlsx' },
      { status: 500 }
    );
  }
}

