
import { KiraBand } from '../components/KiraBand'
import { Bar, InlineError, PageTitle } from '../components/ui'
import { useDishes } from '../lib/queries'
import type { Dish } from '../lib/types'

const SPICE = ['Mild', 'Gentle', 'Hot', 'Fiery']

function Spice({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={`Spice: ${SPICE[level]}`}>
      <span className="flex gap-0.5" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className={`h-2.5 w-1.5  ${n <= level ? 'bg-negative' : 'bg-active'}`} />
        ))}
      </span>
      <span>{SPICE[level]}</span>
    </span>
  )
}

function DishCard({ dish }: { dish: Dish }) {
  return (
    <article className="flex flex-col bg-raised p-5">
      <h2 className="font-serif text-[22px] font-semibold leading-tight tracking-[-0.01em]">{dish.name}</h2>
      <p className="mt-1 text-[14px] text-muted">{dish.tagline}</p>
      <p className="mt-4 text-[15px] leading-relaxed text-ink">{dish.description}</p>
      <p className="mt-3 text-[13px] text-muted">{dish.ingredients.join(' · ')}</p>
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-[13px] text-muted">
        <Spice level={dish.spice} />
        <span>{dish.region}</span>
        <span>{dish.kind}</span>
      </div>
    </article>
  )
}

const TEAM = ['Pelgye Dorji', 'Karma Subba', 'Tshering Dema', 'Dorji Choden']

export default function DishesPage() {
  const { data: dishes, isLoading, isError, refetch } = useDishes()

  return (
    <>
      <PageTitle
        title="Dishes"
        sub="The nine dishes Druk Lens is learning to recognise, chosen because food datasets rarely include them."
      />

      {isError ? (
        <InlineError message="Couldn’t load the dishes." onRetry={() => refetch()} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array.from({ length: 9 }, (_, i) => <Bar key={i} className="h-[300px]" />)
            : dishes?.map((dish) => <DishCard key={dish.slug} dish={dish} />)}
        </div>
      )}

      <section aria-labelledby="about" className="mt-16 overflow-hidden bg-raised">
        <KiraBand height={14} />
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <h2 id="about" className="font-serif text-[24px] font-semibold leading-tight">
              About the project
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed">
              Druk Lens is a CSA301 Deep Learning project at Gyalpozhing College of Information Technology. A
              convolutional network built from scratch will be compared with a transfer-learning model (MobileNetV2 or
              ResNet50) on a dataset of Bhutanese dishes the team is collecting, and the better one will answer here.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed">
              Until then, answers come from a placeholder and are marked as demo answers. Your “right or wrong”
              replies are saved as feedback. They do not retrain the model by themselves, but they show where it
              fails.
            </p>
          </div>
          <div className="lg:col-span-3">
            <h3 className="text-[14px] font-semibold">How a scan works</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-[14px] text-ink marker:text-muted">
              <li>Your photo is resized and normalised exactly as in training.</li>
              <li>The model scores each of the nine dishes.</li>
              <li>The top dish and its confidence are saved to your history.</li>
              <li>Below 60% confidence it says it isn’t sure.</li>
            </ol>
          </div>
          <div className="lg:col-span-3">
            <h3 className="text-[14px] font-semibold">Team</h3>
            <ul className="mt-3 space-y-2 text-[14px]">
              {TEAM.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  )
}
