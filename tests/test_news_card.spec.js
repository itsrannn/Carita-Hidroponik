import { test, expect } from '@playwright/test';

test('news cards should be visible and have images', async ({ page }) => {
  // Mock the API call to Supabase
  await page.route('**/rest/v1/news?select=id%2Ccreated_at%2Ctitle%2Cexcerpt%2Cimage_url&order=created_at.desc&limit=3', async route => {
    const json = [
      {
        id: 1,
        created_at: new Date().toISOString(),
        title: 'Mock News Title 1',
        excerpt: 'This is a mock news excerpt.',
        image_url: 'https://placehold.co/600x400/c7eacb/333?text=Mock+1'
      },
      {
        id: 2,
        created_at: new Date().toISOString(),
        title: 'Mock News Title 2',
        excerpt: 'This is another mock news excerpt.',
        image_url: 'https://placehold.co/600x400/f8d7da/333?text=Mock+2'
      }
    ];
    await route.fulfill({ json });
  });

  await page.goto('http://localhost:8000/index.html');

  // Wait for the news section to be visible
  await page.waitForSelector('.news-card');

  const newsCards = await page.locator('.news-card').all();
  expect(newsCards.length).toBeGreaterThan(0);

  for (const card of newsCards) {
    const image = card.locator('img');
    await expect(image).toBeVisible();
    const imageUrl = await image.getAttribute('src');
    expect(imageUrl).not.toBe('');

    const title = await card.locator('h3').textContent();
    expect(title).toContain('Mock News Title');
  }
});
