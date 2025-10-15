import s from './index.module.less';
import { makeUrl } from '@/utils/routing';
import Button from '@/components/library/Button';
import * as Card from '@/components/ui/Card';
import { TEMPLATE_GROUPS } from '@/pages/workflows/workflows-page/workflows-library/data';

export default function WorkflowsLibrary() {
  return (
    <div className={s.root}>
      {TEMPLATE_GROUPS.map((group, i) => (
        <Card.Root key={i}>
          <Card.Section>
            <div className={s.group}>
              <div className={s.groupHeader}>
                <div>
                  <div className={s.groupTitle}>{group.title}</div>
                  <div className={s.groupDescription}>{group.description}</div>
                </div>
                <Button
                  asLink={true}
                  type="SECONDARY"
                  to={makeUrl('/workflows/:type/create/:templateId', {
                    type: group.type.toLowerCase(),
                    templateId: 'custom',
                  })}
                >
                  Create empty workflow
                </Button>
              </div>
              <div className={s.groupTemplates}>
                {group.templates.map((template, i) => (
                  <Card.Root key={i}>
                    <Card.Section>
                      <div className={s.template}>
                        <div>
                          <div className={s.templateName}>{template.item.name}</div>
                          <div className={s.templateDescription}>{template.description}</div>
                        </div>
                        <Button
                          asLink={true}
                          to={makeUrl('/workflows/:type/create/:templateId', {
                            type: group.type.toLowerCase(),
                            templateId: template.id,
                          })}
                          type="TETRIARY"
                        >
                          Use template
                        </Button>
                      </div>
                    </Card.Section>
                  </Card.Root>
                ))}
              </div>
            </div>
          </Card.Section>
        </Card.Root>
      ))}
    </div>
  );
}
