from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = browser.new_page()

    try:
        try:
            page.goto("http://localhost:5173")
            page.wait_for_load_state('networkidle')
        except Exception as e:
            print(f"Error al navegar a la página: {e}")
            return

        # Verifica la sección de generación automática
        generate_auto_button = page.get_by_role("button", name="Generar Dinosaurio")
        expect(generate_auto_button).to_be_visible()
        generate_auto_button.click()

        # Espera a que aparezca el nombre del dinosaurio (indicador de que la API ha respondido)
        expect(page.locator("div.result h3")).to_be_visible(timeout=10000)
        expect(page.locator("div.image-container img")).to_be_visible(timeout=10000)

        # Verifica la sección de generación manual
        manual_input = page.get_by_placeholder("Escribe un nombre de dinosaurio")
        expect(manual_input).to_be_visible()
        manual_input.fill("Testosaurus")

        generate_manual_button = page.get_by_role("button", name="Generar Imagen por Nombre")
        expect(generate_manual_button).to_be_visible()
        generate_manual_button.click()

        # Espera a que aparezca la imagen generada manualmente
        expect(page.locator("div.section:nth-child(2) > div.image-container > img")).to_be_visible(timeout=5000)

        page.screenshot(path="jules-scratch/verification/verification.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
