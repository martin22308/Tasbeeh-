import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

test('renders tasbeeh committee application title', async () => {
  render(<App />);
  await waitFor(
    () => {
      const titleElements = screen.getAllByText(/فريق التسبيح/i);
      expect(titleElements.length).toBeGreaterThan(0);
    },
    { timeout: 3000 }
  );
});
