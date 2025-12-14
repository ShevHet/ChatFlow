const XLSX = require('xlsx');
const path = require('path');

// Создаем простую таблицу с данными
const data = [
  ['Имя', 'Возраст', 'Город', 'Зарплата'],
  ['Иван', 25, 'Москва', 50000],
  ['Мария', 30, 'Санкт-Петербург', 60000],
  ['Петр', 28, 'Казань', 55000],
  ['Анна', 32, 'Новосибирск', 65000],
];

const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.aoa_to_sheet(data);
XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

const filePath = path.join(__dirname, '..', 'example.xlsx');
XLSX.writeFile(workbook, filePath);

console.log(`Файл example.xlsx создан в ${filePath}`);







