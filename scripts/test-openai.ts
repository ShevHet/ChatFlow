/**
 * Скрипт для проверки подключения к OpenAI API
 * Помогает диагностировать проблемы с регионом и API ключом
 */

async function testOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error("❌ OPENAI_API_KEY не установлен в .env.local");
    console.log("Создайте файл .env.local в корне проекта и добавьте:");
    console.log("OPENAI_API_KEY=your_api_key_here");
    process.exit(1);
  }
  
  console.log("🔍 Проверка подключения к OpenAI API...");
  console.log(`📝 API ключ: ${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}`);
  
  try {
    // Простой тестовый запрос
    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
      console.error("❌ Ошибка при подключении к OpenAI API:");
      console.error(`   Статус: ${response.status} ${response.statusText}`);
      console.error(`   Ошибка: ${JSON.stringify(errorData, null, 2)}`);
      
      if (errorData.error?.message?.includes("Country") || errorData.error?.message?.includes("region")) {
        console.error("\n⚠️  ПРОБЛЕМА С РЕГИОНОМ:");
        console.error("   1. Убедитесь, что VPN подключен к поддерживаемому региону (США, Европа)");
        console.error("   2. Проверьте ваш IP адрес: https://whatismyipaddress.com/");
        console.error("   3. Перезапустите приложение после включения VPN");
        console.error("   4. Попробуйте другой VPN сервер");
      } else if (errorData.error?.message?.includes("Invalid API key")) {
        console.error("\n⚠️  ПРОБЛЕМА С API КЛЮЧОМ:");
        console.error("   1. Проверьте правильность ключа в .env.local");
        console.error("   2. Убедитесь, что ключ активен на https://platform.openai.com/api-keys");
        console.error("   3. Проверьте, что у ключа есть доступ к API");
      }
      
      process.exit(1);
    }
    
    const data = await response.json();
    console.log("✅ Подключение к OpenAI API успешно!");
    console.log(`📊 Доступно моделей: ${data.data?.length || 0}`);
    console.log("\n💡 Если ошибка все еще возникает в приложении:");
    console.log("   1. Перезапустите сервер разработки (bun run stop && bun run dev)");
    console.log("   2. Очистите кеш браузера");
    console.log("   3. Проверьте, что .env.local загружается правильно");
    
  } catch (error: any) {
    console.error("❌ Ошибка при тестировании:");
    console.error(error.message);
    if (error.message.includes("fetch")) {
      console.error("\n⚠️  Проблема с сетевым подключением:");
      console.error("   1. Проверьте интернет соединение");
      console.error("   2. Проверьте, не блокирует ли файрвол запросы к api.openai.com");
    }
    process.exit(1);
  }
}

testOpenAI();

