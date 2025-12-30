import { GoogleGenAI, Type } from "@google/genai";

// Main UI Elements
const heroNameInput = document.getElementById('heroName') as HTMLInputElement;
const themeSelect = document.getElementById('themeSelect') as HTMLSelectElement;
const regenBtn = document.getElementById('regenBtn') as HTMLButtonElement;
const makeGameBtn = document.getElementById('makeGameBtn') as HTMLButtonElement;
const snapshotDiv = document.getElementById('snapshot') as HTMLDivElement;
const outlineArticle = document.getElementById('outline') as HTMLElement;

// Modal UI Elements
const gameModal = document.getElementById('gameModal') as HTMLDivElement;
const modalCloseBtn = document.getElementById('modalCloseBtn') as HTMLButtonElement;
const gameIframe = document.getElementById('gameIframe') as HTMLIFrameElement;
const downloadGameBtn = document.getElementById('downloadGameBtn') as HTMLButtonElement;


let currentStorylineText: string | null = null;
let currentGameHtml: string | null = null;

// Initialize the Gemini client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Define the expected JSON structure for the Gemini response
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    logline: { type: Type.STRING },
    snapshot: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    outline: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          chapter: { type: Type.STRING },
          description: { type: Type.STRING },
        },
        required: ['chapter', 'description'],
      },
    },
  },
  required: ['title', 'logline', 'snapshot', 'outline'],
};


/**
 * Sets the loading state for the UI, disabling buttons and showing placeholders.
 * @param {boolean} isLoading - Whether to show or hide the loading state.
 */
function setLoadingState(isLoading: boolean) {
  regenBtn.disabled = isLoading;
  if (isLoading) {
    regenBtn.textContent = 'Generating...';
    snapshotDiv.innerHTML = '<div class="loading-placeholder">Conjuring ideas...</div>';
    outlineArticle.innerHTML = '<div class="loading-placeholder">Weaving the narrative threads...</div>';
  } else {
    regenBtn.textContent = 'Regenerate Storyline';
  }
}

/**
 * Updates the UI with the generated storyline.
 * @param {any} data - The parsed JSON data from the Gemini API.
 */
function updateUI(data: any) {
  // Clear existing content
  snapshotDiv.innerHTML = '';
  outlineArticle.innerHTML = '';

  // Populate Snapshot
  const snapshotList = document.createElement('ul');
  data.snapshot.forEach((item: string) => {
    const listItem = document.createElement('li');
    listItem.textContent = item;
    snapshotList.appendChild(listItem);
  });
  snapshotDiv.appendChild(snapshotList);

  // Populate Outline
  const title = document.createElement('h3');
  title.textContent = data.title;
  const logline = document.createElement('h4');
  logline.textContent = data.logline;
  outlineArticle.appendChild(title);
  outlineArticle.appendChild(logline);

  data.outline.forEach((chapter: { chapter: string; description: string }) => {
    const chapterTitle = document.createElement('h5');
    chapterTitle.textContent = chapter.chapter;
    const chapterDesc = document.createElement('p');
    chapterDesc.textContent = chapter.description;
    outlineArticle.appendChild(chapterTitle);
    outlineArticle.appendChild(chapterDesc);
  });
}

/**
 * Generates the storyline by calling the Gemini API.
 */
async function generateStoryline() {
  setLoadingState(true);
  makeGameBtn.disabled = true;
  currentStorylineText = null;
  currentGameHtml = null;

  const heroName = heroNameInput.value || 'the protagonist';
  const theme = themeSelect.value;

  const prompt = `
    Create a compelling storyline for an HTML5 browser game.
    Protagonist's Name: ${heroName}
    Theme/Tone: ${theme}

    Follow this structure:
    - Title: A catchy title for the game.
    - Logline: A one-sentence summary of the story.
    - Snapshot: A bulleted list of 3-5 key story elements (e.g., setting, main conflict, a key character).
    - Outline: A 5-part story outline, with each part having a 'chapter' title (e.g., 'Act I: The Inciting Incident') and a 'description' paragraph.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const responseText = response.text.trim();
    const data = JSON.parse(responseText);
    
    updateUI(data);

    // Prepare text for game generation
    let storyText = `Title: ${data.title}\n`;
    storyText += `Logline: ${data.logline}\n\n`;
    storyText += `--- Snapshot ---\n`;
    data.snapshot.forEach((item: string) => (storyText += `- ${item}\n`));
    storyText += `\n--- Story Outline ---\n`;
    data.outline.forEach((chapter: { chapter: string; description: string }) => {
        storyText += `\n${chapter.chapter}\n`;
        storyText += `${chapter.description}\n`;
    });
    currentStorylineText = storyText;
    makeGameBtn.disabled = false;

  } catch (error) {
    console.error("Error generating storyline:", error);
    outlineArticle.innerHTML = `<p style="color: #ff8a80;">Sorry, an error occurred while generating the story. Please try again.</p>`;
  } finally {
    setLoadingState(false);
  }
}

/**
 * Generates a playable game from the storyline.
 */
async function generateGame() {
    if (!currentStorylineText) {
        alert("Please generate a storyline first.");
        return;
    }
    
    makeGameBtn.disabled = true;
    makeGameBtn.textContent = 'Making Game...';
    currentGameHtml = null;

    const theme = themeSelect.options[themeSelect.selectedIndex].text;

    const prompt = `
      You are an expert HTML5 game developer. Convert the following storyline into a single, self-contained HTML file that functions as a simple choice-based text adventure game.

      **Storyline to Convert:**
      ${currentStorylineText}

      **Requirements:**
      1.  **Single File:** The entire game (HTML, CSS, JavaScript) must be in one single \`.html\` file. Do not use any external files.
      2.  **Structure:** The game should have a main title. It must display one chapter/act at a time.
      3.  **Interactivity:** At the end of each chapter's description, provide 2 or 3 thematic choices as buttons. Clicking a choice should hide the current chapter and reveal the next one. The final chapter can have a "The End" or "Play Again" button.
      4.  **Styling:** The visual theme should be clean, modern, and reflect the story's tone: "${theme}". Use Google Fonts if possible. The layout must be responsive and look good on both desktop and mobile.
      5.  **Code:** Use vanilla JavaScript. The JS should be embedded in a \`<script>\` tag within the \`<body>\`. CSS should be in a \`<style>\` tag in the \`<head>\`.
      6.  **Output:** The final output MUST BE ONLY the full HTML code, starting with \`<!DOCTYPE html>\` and ending with \`</html>\`. Do not include any explanations or markdown formatting like \`\`\`html.
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        const rawHtml = response.text.trim();
        // Clean up potential markdown formatting from the response
        currentGameHtml = rawHtml.replace(/^```html|```$/g, '');

        gameIframe.srcdoc = currentGameHtml;
        gameModal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling

    } catch (error) {
        console.error("Error generating game:", error);
        alert("Sorry, there was an error creating the game. Please try again.");
    } finally {
        makeGameBtn.disabled = false;
        makeGameBtn.textContent = 'Make This Game';
    }
}

/**
 * Triggers a download of the generated game HTML.
 */
function downloadGame() {
    if (!currentGameHtml) return;

    const blob = new Blob([currentGameHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'game.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function closeModal() {
    gameModal.style.display = 'none';
    gameIframe.srcdoc = ''; // Clear iframe content
    document.body.style.overflow = 'auto';
}

// Event Listeners
regenBtn.addEventListener('click', generateStoryline);
makeGameBtn.addEventListener('click', generateGame);
downloadGameBtn.addEventListener('click', downloadGame);
modalCloseBtn.addEventListener('click', closeModal);

// Initial generation on page load
document.addEventListener('DOMContentLoaded', generateStoryline);
