### Feature Design: Enhanced Portrait Selection

#### 1. Objective

To replace the direct file upload for the "Portrait" input with an interactive Bottom Sheet. This sheet will allow users to select from two sources:
*   **My Photos**: A gallery of their own previously uploaded and saved portraits.
*   **Idols**: A curated, pre-defined gallery of model or celebrity photos to try styles on.

#### 2. UI/UX Flow

1.  The user taps the "Portrait" card on the main page.
2.  A Bottom Sheet slides up from the bottom of the screen.
3.  The sheet will feature a Tab component at the top with two options: "My Photos" and "Idols".
4.  **"My Photos" Tab (Default View)**:
    *   Displays a grid of the user's saved portraits.
    *   Includes a prominent "Add New Photo" button to allow users to upload a new picture from their device.
    *   This section will function almost identically to a single category in the "My Wardrobe" component (including upload, compression, and deletion).
5.  **"Idols" Tab**:
    *   Displays a grid of high-quality, pre-selected model/celebrity images.
    *   These images will be ready to use immediately.
6.  The user taps on any image from either tab.
7.  The Bottom Sheet automatically closes.
8.  The selected image (whether their own or an idol's) instantly appears in the "Portrait" card on the main page, ready for generation.

#### 3. Component Breakdown

*   **`app/page.tsx` (Modified)**
    *   It will manage a new state, `isPortraitSheetOpen`, to control the visibility of the new bottom sheet.
    *   The `CompactUpload` component for "Portrait" will be changed to a trigger that opens the sheet.
    *   It will have a new handler function, `handlePortraitSelect(imageSrc: string)`, which will update the `selfiePreview` and close the sheet.

*   **`app/components/portrait-selection-sheet.tsx` (New Component)**
    *   This will be the core of the new feature.
    *   It will use the `vaul` Drawer component for the bottom sheet functionality.
    *   It will contain a Tab component (e.g., from Radix UI, which is part of Shadcn) to switch between "My Photos" and "Idols".
    *   **My Photos Logic**: It will manage an array of user portraits, saving to and retrieving from `localStorage` under a new key (`styleai_portraits`). It will reuse our existing image compression logic.
    *   **Idols Logic**: It will contain a hardcoded array of idol image objects. For this initial version, the images can be stored locally in the `/public` directory.
    *   It will accept the `onPortraitSelect` function as a prop to communicate the selected image back to the main page.

#### 4. Data Storage

*   **User Photos (`localStorage`)**
    *   **Key**: `styleai_portraits`
    *   **Structure**: `[{ id: string, imageSrc: string }]`
*   **Idol Photos (Hardcoded)**
    *   A constant array will be defined inside `portrait-selection-sheet.tsx`.
    *   **Example**: `const IDOLS = [{ id: 'idol-1', name: 'Zendaya', imageSrc: '/idols/idol-1.jpg' }, ...]`