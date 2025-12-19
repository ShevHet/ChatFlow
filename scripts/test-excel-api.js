/**
 * Скрипт для автоматического тестирования Excel API endpoints
 * 
 * Использование:
 *   node scripts/test-excel-api.js [base-url]
 * 
 * По умолчанию использует http://localhost:3000
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const TEST_FILE_PATH = path.join(__dirname, '..', 'test-data.xlsx');

// Цвета для вывода
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

let testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  errors: [],
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(options.url || options.path, BASE_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const reqOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = client.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed,
            rawBody: body,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body,
            rawBody: body,
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(data);
    }

    req.end();
  });
}

function makeFormDataRequest(url, filePath, fileName = 'file') {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url, BASE_URL);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const fileData = fs.readFileSync(filePath);
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    
    const formData = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="${fileName}"; filename="${path.basename(filePath)}"\r\n`),
      Buffer.from(`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`),
      fileData,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': formData.length,
      },
    };

    const req = client.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: JSON.parse(body),
            rawBody: body,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body,
            rawBody: body,
          });
        }
      });
    });

    req.on('error', reject);
    req.write(formData);
    req.end();
  });
}

async function test(name, testFn) {
  testResults.total++;
  process.stdout.write(`\n[${testResults.total}] ${name}... `);
  
  try {
    await testFn();
    testResults.passed++;
    log('✓ PASSED', 'green');
    return true;
  } catch (error) {
    testResults.failed++;
    testResults.errors.push({ name, error: error.message });
    log(`✗ FAILED: ${error.message}`, 'red');
    return false;
  }
}

async function runTests() {
  log('\n╔═══════════════════════════════════════════════════════════╗', 'cyan');
  log('║     Автоматическое тестирование Excel API Endpoints      ║', 'cyan');
  log('╚═══════════════════════════════════════════════════════════╝', 'cyan');
  log(`\nБазовый URL: ${BASE_URL}`, 'blue');
  log(`Тестовый файл: ${TEST_FILE_PATH}\n`, 'blue');

  // Проверка существования тестового файла
  if (!fs.existsSync(TEST_FILE_PATH)) {
    log('\n⚠️  Тестовый файл не найден!', 'yellow');
    log(`   Создайте файл командой: npm run create-test-excel`, 'yellow');
    log(`   Или укажите путь к существующему Excel файлу.\n`, 'yellow');
    process.exit(1);
  }

  let uploadedFileId = null;

  // Тест 1: Загрузка Excel файла
  await test('Загрузка Excel файла (POST /api/excel/upload)', async () => {
    const response = await makeFormDataRequest('/api/excel/upload', TEST_FILE_PATH);
    
    if (response.status !== 200) {
      throw new Error(`Ожидался статус 200, получен ${response.status}. Ответ: ${JSON.stringify(response.body)}`);
    }
    
    if (!response.body.success) {
      throw new Error(`Запрос не успешен. Ответ: ${JSON.stringify(response.body)}`);
    }
    
    if (!response.body.fileId || typeof response.body.fileId !== 'number') {
      throw new Error(`fileId отсутствует или имеет неверный тип. Ответ: ${JSON.stringify(response.body)}`);
    }
    
    uploadedFileId = response.body.fileId;
    
    if (!response.body.metadata) {
      throw new Error('Метаданные отсутствуют в ответе');
    }
  });

  if (!uploadedFileId) {
    log('\n❌ Не удалось загрузить файл. Дальнейшие тесты пропущены.', 'red');
    printSummary();
    process.exit(1);
  }

  // Тест 2: Получение метаданных и данных файла
  await test(`Получение данных файла (GET /api/excel/${uploadedFileId})`, async () => {
    const response = await makeRequest({
      method: 'GET',
      url: `/api/excel/${uploadedFileId}`,
    });
    
    if (response.status !== 200) {
      throw new Error(`Ожидался статус 200, получен ${response.status}`);
    }
    
    if (!response.body.success) {
      throw new Error(`Запрос не успешен. Ответ: ${JSON.stringify(response.body)}`);
    }
    
    if (!response.body.metadata) {
      throw new Error('Метаданные отсутствуют в ответе');
    }
    
    if (!Array.isArray(response.body.data)) {
      throw new Error('Данные должны быть массивом');
    }
    
    if (!response.body.pagination) {
      throw new Error('Информация о пагинации отсутствует');
    }
  });

  // Тест 3: Пагинация
  await test(`Пагинация данных (GET /api/excel/${uploadedFileId}?offset=2&limit=3)`, async () => {
    const response = await makeRequest({
      method: 'GET',
      url: `/api/excel/${uploadedFileId}?offset=2&limit=3`,
    });
    
    if (response.status !== 200) {
      throw new Error(`Ожидался статус 200, получен ${response.status}`);
    }
    
    if (!Array.isArray(response.body.data)) {
      throw new Error('Данные должны быть массивом');
    }
    
    if (response.body.data.length > 3) {
      throw new Error(`Ожидалось максимум 3 строки, получено ${response.body.data.length}`);
    }
    
    if (response.body.pagination.offset !== 2) {
      throw new Error(`Ожидался offset=2, получен ${response.body.pagination.offset}`);
    }
    
    if (response.body.pagination.limit !== 3) {
      throw new Error(`Ожидался limit=3, получен ${response.body.pagination.limit}`);
    }
  });

  // Тест 4: Список файлов
  await test('Получение списка файлов (GET /api/excel/list)', async () => {
    const response = await makeRequest({
      method: 'GET',
      url: '/api/excel/list',
    });
    
    if (response.status !== 200) {
      throw new Error(`Ожидался статус 200, получен ${response.status}`);
    }
    
    if (!response.body.success) {
      throw new Error(`Запрос не успешен. Ответ: ${JSON.stringify(response.body)}`);
    }
    
    if (!Array.isArray(response.body.files)) {
      throw new Error('files должен быть массивом');
    }
    
    if (response.body.count !== response.body.files.length) {
      throw new Error(`count (${response.body.count}) не совпадает с длиной массива files (${response.body.files.length})`);
    }
    
    // Проверяем, что загруженный файл есть в списке
    const found = response.body.files.find(f => f.fileId === uploadedFileId);
    if (!found) {
      throw new Error(`Загруженный файл (ID: ${uploadedFileId}) не найден в списке`);
    }
  });

  // Тест 5: Получение несуществующего файла
  await test('Получение несуществующего файла (GET /api/excel/99999)', async () => {
    const response = await makeRequest({
      method: 'GET',
      url: '/api/excel/99999',
    });
    
    if (response.status !== 404) {
      throw new Error(`Ожидался статус 404, получен ${response.status}`);
    }
  });

  // Тест 6: Удаление файла
  await test(`Удаление файла (DELETE /api/excel/${uploadedFileId})`, async () => {
    const response = await makeRequest({
      method: 'DELETE',
      url: `/api/excel/${uploadedFileId}`,
    });
    
    if (response.status !== 200) {
      throw new Error(`Ожидался статус 200, получен ${response.status}`);
    }
    
    if (!response.body.success) {
      throw new Error(`Запрос не успешен. Ответ: ${JSON.stringify(response.body)}`);
    }
  });

  // Тест 7: Попытка получить удаленный файл
  await test(`Получение удаленного файла (GET /api/excel/${uploadedFileId})`, async () => {
    const response = await makeRequest({
      method: 'GET',
      url: `/api/excel/${uploadedFileId}`,
    });
    
    if (response.status !== 404) {
      throw new Error(`Ожидался статус 404 после удаления, получен ${response.status}`);
    }
  });

  // Итоги
  printSummary();
}

function printSummary() {
  log('\n╔═══════════════════════════════════════════════════════════╗', 'cyan');
  log('║                      Итоги тестирования                   ║', 'cyan');
  log('╚═══════════════════════════════════════════════════════════╝', 'cyan');
  
  const passRate = ((testResults.passed / testResults.total) * 100).toFixed(1);
  
  log(`\nВсего тестов: ${testResults.total}`, 'blue');
  log(`Пройдено: ${testResults.passed}`, 'green');
  log(`Провалено: ${testResults.failed}`, testResults.failed > 0 ? 'red' : 'green');
  log(`Процент успеха: ${passRate}%`, passRate === '100.0' ? 'green' : 'yellow');
  
  if (testResults.errors.length > 0) {
    log('\n❌ Ошибки:', 'red');
    testResults.errors.forEach(({ name, error }, index) => {
      log(`  ${index + 1}. ${name}`, 'red');
      log(`     ${error}`, 'yellow');
    });
  }
  
  log('');
  
  if (testResults.failed === 0) {
    log('✅ Все тесты пройдены успешно!', 'green');
    process.exit(0);
  } else {
    log('❌ Некоторые тесты провалились. Проверьте ошибки выше.', 'red');
    process.exit(1);
  }
}

// Запуск тестов
runTests().catch((error) => {
  log(`\n❌ Критическая ошибка: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

