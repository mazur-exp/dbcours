// ========================================
// УНИВЕРСАЛЬНЫЙ ПАРСЕР ДЛЯ N8N CODE НОДЫ
// Работает с любой AI моделью: Claude, GPT, Gemini, DeepSeek, Llama, etc.
// ========================================

// Получаем output от AI Agent
const rawOutput = $input.item.json.output;

console.log('=== Universal AI Parser ===');
console.log('Raw output length:', rawOutput.length);
console.log('First 200 chars:', rawOutput.substring(0, 200));

// Функция для извлечения данных из AI response
function parseAIResponse(text) {
  let cleanText = text.trim();

  // Шаг 1: Убираем markdown code blocks если есть
  if (cleanText.startsWith('```json') || cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```json\n?/g, '')
                         .replace(/^```\n?/g, '')
                         .replace(/\n?```$/g, '');
    console.log('Removed markdown code blocks');
  }

  // Шаг 2: Убираем лидирующие/завершающие экранированные \n (DeepSeek pattern)
  if (cleanText.startsWith('\\n') || cleanText.startsWith('{\\n')) {
    cleanText = cleanText.replace(/^\{?\\n\s*/g, '{')
                         .replace(/\\n\s*\}$/g, '}');
    console.log('Cleaned DeepSeek escaped newlines');
  }

  // МЕТОД 1: Прямой JSON.parse (для чистого JSON)
  try {
    const parsed = JSON.parse(cleanText);
    if (parsed.output) {
      console.log('✅ Method 1 SUCCESS: Direct JSON.parse');
      return {
        text: parsed.output,
        real_name: parsed.real_name || "",
        background: parsed.background || "",
        query: parsed.query || "",
        ready: String(parsed.ready || "0")
      };
    }
  } catch (e) {
    console.log('Method 1 failed:', e.message);
  }

  // МЕТОД 2: Конвертация экранированных символов (для DeepSeek/Gemini)
  try {
    // Преобразуем литеральные \n, \r, \t в реальные символы
    const unescaped = cleanText
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"');  // И экранированные кавычки

    const parsed = JSON.parse(unescaped);
    if (parsed.output) {
      console.log('✅ Method 2 SUCCESS: Unescaped + JSON.parse');
      return {
        text: parsed.output,
        real_name: parsed.real_name || "",
        background: parsed.background || "",
        query: parsed.query || "",
        ready: String(parsed.ready || "0")
      };
    }
  } catch (e) {
    console.log('Method 2 failed:', e.message);
  }

  // МЕТОД 3: Regex extraction (работает ВСЕГДА, даже с невалидным JSON)
  console.log('Using Method 3: Regex extraction (fallback)');

  // Regex для извлечения полей (обрабатывает escaped кавычки и переносы)
  const outputMatch = cleanText.match(/"output"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
  const realNameMatch = cleanText.match(/"real_name"\s*:\s*"([^"]*)"/);
  const backgroundMatch = cleanText.match(/"background"\s*:\s*"([^"]*)"/);
  const queryMatch = cleanText.match(/"query"\s*:\s*"([^"]*)"/);
  const readyMatch = cleanText.match(/"ready"\s*:\s*"?(\d+)"?/);

  if (outputMatch || realNameMatch || backgroundMatch || queryMatch) {
    console.log('✅ Method 3 SUCCESS: Regex extraction');

    // Декодируем экранированные символы в извлеченном тексте
    const decodeEscaped = (str) => {
      if (!str) return "";
      return str.replace(/\\n/g, '\n')
                .replace(/\\r/g, '\r')
                .replace(/\\t/g, '\t')
                .replace(/\\"/g, '"');
    };

    return {
      text: decodeEscaped(outputMatch ? outputMatch[1] : text),
      real_name: realNameMatch ? realNameMatch[1] : "",
      background: backgroundMatch ? backgroundMatch[1] : "",
      query: queryMatch ? queryMatch[1] : "",
      ready: readyMatch ? readyMatch[1] : "0"
    };
  }

  // Если все методы провалились - возвращаем raw output как text
  console.log('⚠️ All methods failed, returning raw output');
  return {
    text: rawOutput,
    real_name: "",
    background: "",
    query: "",
    ready: "0"
  };
}

// Парсим и возвращаем результат
const result = parseAIResponse(rawOutput);

console.log('=== Parser Result ===');
console.log('Text length:', result.text.length);
console.log('Real name:', result.real_name);
console.log('Background:', result.background ? result.background.substring(0, 50) + '...' : '(empty)');
console.log('Query:', result.query ? result.query.substring(0, 50) + '...' : '(empty)');
console.log('Ready:', result.ready);

return result;
