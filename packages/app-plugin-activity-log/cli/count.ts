import { AppCommand } from '@nocobase/app-cli';
export default class CountActivity extends AppCommand {
  static override summary =
    'Count activity records in the configured application.';
  public async run(): Promise<{ count: number }> {
    await this.parse(CountActivity);
    const { activityLogToken } = await import('../server/contracts.js');
    return this.withApp(async ({ app }) => {
      await app.start();
      return { count: await app.container.resolve(activityLogToken).count() };
    });
  }
}
