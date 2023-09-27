import { test, expect } from '@playwright/test';
import { resetDatabaseAndImportDataFromPath } from '../../scripts/dts-import';
import { login } from '../../utils/login';
import {
  addDefaultField,
  createComponent,
  createContentType,
  deleteContentType,
  verifyFieldPresence,
  waitForReload,
} from '../../utils/content-type-builder';

// all tests are run for single and collection types, because there
// is no difference in creating them
const types = ['collection type', 'single type'];
const type = types[0];

test.describe(`Content Type Builder | Content-Type | ${type}`, () => {
  test.beforeEach(async ({ page }) => {
    // Accept the confirmation dialog that is displayed when
    // clicking delete
    page.on('dialog', (dialog) => dialog.accept());

    await resetDatabaseAndImportDataFromPath('./e2e/data/with-admin.tar');
    await page.goto('/admin');
    await login({ page });
    await page.getByRole('link', { name: 'Content-Type Builder' }).click();
  });

  test('A user should be able to create a content type using simple fields', async ({ page }) => {
    const deleteContentType = await createContentType({ page, type, displayName: `CT ${type}` });

    const addMoreAttrs = {
      addMore: true,
      contentTypeName: `CT ${type}`,
    };

    await addDefaultField({
      page,
      type: 'Text',
      name: 'textField',
      ...addMoreAttrs,
    });
    await addDefaultField({
      page,
      type: 'Email',
      name: 'emailField',
      ...addMoreAttrs,
    });
    await addDefaultField({
      page,
      type: 'RichText',
      name: 'richtextField',
      ...addMoreAttrs,
    });
    await addDefaultField({
      page,
      type: 'Password',
      name: 'passwordField',
      ...addMoreAttrs,
    });
    await addDefaultField({ page, type: 'Number', name: 'numberField', ...addMoreAttrs });
    await addDefaultField({
      page,
      type: 'Enumeration',
      name: 'enumField',
      values: ['first', 'second'],
      ...addMoreAttrs,
    });
    await addDefaultField({ page, type: 'Date', name: 'dateField', ...addMoreAttrs });
    await addDefaultField({
      page,
      type: 'Date',
      name: 'datetimeField',
      dateType: 'datetime',
      ...addMoreAttrs,
    });
    await addDefaultField({
      page,
      type: 'Date',
      name: 'timeField',
      dateType: 'time',
      ...addMoreAttrs,
    });
    await addDefaultField({ page, type: 'Boolean', name: 'booleanField', ...addMoreAttrs });
    await addDefaultField({ page, type: 'JSON', name: 'JSONField' });

    await page.getByRole('button', { name: 'Save' }).click();
    await waitForReload({ page });

    // Verify the content-type has been created
    await expect(page.getByRole('heading', { name: `CT ${type}` })).toBeVisible();

    // Verify the content-type contains the field(s)
    await verifyFieldPresence({ page, name: 'textField' });
    await verifyFieldPresence({ page, name: 'textField' });
    await verifyFieldPresence({ page, name: 'emailField' });
    await verifyFieldPresence({ page, name: 'richtextField' });
    await verifyFieldPresence({ page, name: 'passwordField' });
    await verifyFieldPresence({ page, name: 'numberField' });
    await verifyFieldPresence({ page, name: 'dateField' });
    await verifyFieldPresence({ page, name: 'datetimeField' });
    await verifyFieldPresence({ page, name: 'timeField' });
    await verifyFieldPresence({ page, name: 'booleanField' });
    await verifyFieldPresence({ page, name: 'JSONField' });

    // Cleanup
    await deleteContentType();

    // TODO: validate content-type has been deleted
  });

  test('A user should be able to create a content type using relational fields', async ({
    page,
  }) => {
    // Create source content-type
    const deleteSourceContentType = await createContentType({
      page,
      type,
      displayName: `Source CT ${type}`,
    });

    await addDefaultField({
      page,
      type: 'Text',
      name: 'textField',
    });

    await page.getByRole('button', { name: 'Save' }).click();
    await waitForReload({ page });

    // Create target content-type
    const deleteTargetContentType = await createContentType({
      page,
      type,
      displayName: `Target CT ${type}`,
    });

    await addDefaultField({
      page,
      type: 'Relation',
      name: 'relationField',
      sourceContentType: `Source CT ${type}`,
    });

    await page.getByRole('button', { name: 'Save' }).click();
    await waitForReload({ page });

    // Verify the content-type contains the field(s)
    await verifyFieldPresence({ page, name: 'relationField' });

    // Cleanup
    await deleteSourceContentType();
    await deleteTargetContentType();
  });

  test('A user should be able to create a content type using a uid field', async ({ page }) => {
    const deleteContentType = await createContentType({ page, type, displayName: `CT ${type}` });

    const addMoreAttrs = {
      addMore: true,
      contentTypeName: `CT ${type}`,
    };

    await addDefaultField({
      page,
      type: 'Text',
      name: 'textField',
      ...addMoreAttrs,
    });

    await addDefaultField({
      page,
      type: 'UID',
      name: 'uidField',
      attachedField: 'textField',
      contentTypeName: addMoreAttrs.contentTypeName,
    });

    await page.getByRole('button', { name: 'Save' }).click();
    await waitForReload({ page });

    // Verify the content-type contains the field(s)
    await verifyFieldPresence({ page, name: 'uidField' });

    // Cleanup
    await deleteContentType();
  });

  test('A user should be able to create a content type using a single component', async ({
    page,
  }) => {
    // Create component
    const deleteComponent = await createComponent({
      page,
      category: 'new-component',
      displayName: `Component ${type}`,
    });
    await addDefaultField({
      page,
      type: 'Text',
      name: 'textField',
    });

    await page.getByRole('button', { name: 'Save' }).click();
    await waitForReload({ page });

    // Create content-type
    const deleteContentType = await createContentType({ page, type, displayName: `CT ${type}` });
    await addDefaultField({
      page,
      type: 'Component',
      name: 'componentField',
      existingComponentName: `Component ${type}`,
      existingComponentCategory: 'new-component',
    });

    await page.getByRole('button', { name: 'Save' }).click();
    await waitForReload({ page });

    // Verify the content-type contains the field(s)
    await verifyFieldPresence({ page, name: 'componentField' });

    // Cleanup
    await deleteContentType();
    await deleteComponent();
  });

  test('A user should be able to create a content type using a repeatable component', async ({
    page,
  }) => {
    // Create component
    const deleteComponent = await createComponent({
      page,
      category: 'new-component',
      displayName: `Component ${type}`,
    });
    await addDefaultField({
      page,
      type: 'Text',
      name: 'textField',
    });

    await page.getByRole('button', { name: 'Save' }).click();
    await waitForReload({ page });

    // Create content-type
    const deleteContentType = await createContentType({ page, type, displayName: `CT ${type}` });

    await addDefaultField({
      page,
      type: 'Component',
      name: 'componentField',
      existingComponentName: `Component ${type}`,
      existingComponentCategory: 'new-component',
      repeatable: true,
    });

    await page.getByRole('button', { name: 'Save' }).click();
    await waitForReload({ page });

    // Verify the content-type contains the field(s)
    await verifyFieldPresence({ page, name: 'componentField' });

    // Cleanup
    await deleteContentType();
    await deleteComponent();
  });

  test('A user should be able to edit a content-type', async ({ page }) => {
    await page.getByRole('button', { name: `Create new ${type}` }).click();
    await page.getByLabel('Display name').fill(`${type} Article`);

    // API IDs should be auto-generated based on the initial display name
    await expect(page.getByLabel('API ID (Singular)')).toHaveValue(
      type === 'single type' ? `single-type-article` : `collection-type-article`
    );
    await expect(page.getByLabel('API ID (Plural)')).toHaveValue(
      type === 'single type' ? `single-type-articles` : `collection-type-articles`
    );

    // API IDs should change when the display name changes
    await page.getByLabel('Display name').fill('Something');
    await expect(page.getByLabel('API ID (Singular)')).toHaveValue('something');
    await expect(page.getByLabel('API ID (Plural)')).toHaveValue('somethings');

    await page.getByRole('button', { name: 'Continue' }).click();

    await addDefaultField({
      page,
      type: 'Text',
      name: 'textField',
    });

    await page.getByRole('button', { name: 'Save' }).click();
    await waitForReload({ page });

    // Edit
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Display name').fill('Something else');

    // The API IDs should not change when editing a content-type
    await expect(page.getByLabel('API ID (Singular)')).toHaveValue('something');
    await expect(page.getByLabel('API ID (Plural)')).toHaveValue('somethings');

    await page.getByRole('button', { name: 'Finish' }).click();
    await waitForReload({ page });

    // Verify the content-type has been created
    await expect(page.getByRole('heading', { name: `Something else` })).toBeVisible();

    // Cleanup
    await deleteContentType({ page, displayName: `Something else` });
  });
});
